# Parking Management System

Real-time, multi-project parking management for commercial buildings, business parks and
campuses. Gate staff get an instant answer to "does this company have parking available for
this vehicle type?", entries/exits are recorded as atomic, concurrency-safe transactions, and
every connected screen updates live with no manual refresh.

## Architecture

```
parking system/
├── backend/    Express + TypeScript API, MongoDB (Mongoose), Socket.IO real-time layer
└── frontend/   Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
```

The frontend is a pure API client — it never talks to MongoDB directly. All data, auth and
real-time events flow through the backend's REST API and Socket.IO server.

- **Database**: MongoDB (Mongoose). Every collection that needs it carries a `projectId` for
  strict per-project data isolation.
- **Auth**: JWT access token (15 min, httpOnly cookie) + refresh token (7 days, httpOnly
  cookie, scoped to `/api/auth`). Passwords are hashed with bcrypt (12 rounds). Every protected
  route re-verifies identity, role and project access server-side — the client's claimed role
  is never trusted.
- **Concurrency safety**: vehicle entries/exits run inside MongoDB transactions. Capacity is
  enforced with a conditional atomic update (`occupied < capacity`) on a per-allocation
  `occupancy` document, and session completion uses a conditional update
  (`status: "ACTIVE" → "COMPLETED"`) so two simultaneous requests for the same slot/session can
  never both succeed. See `backend/src/services/parkingService.ts`.
- **Real-time**: the backend broadcasts `availability:update`, `session:entry` and
  `session:exit` over Socket.IO to a per-project room immediately after each transaction
  commits. No polling, no MongoDB Change Streams needed for a single backend instance; if you
  horizontally scale the API, add Change Streams or Socket.IO's Redis adapter so all instances
  broadcast the same events (the code is structured so that's a drop-in addition — see the
  comment in `socketServer.ts`).
- **File storage**: company logos upload to Cloudinary when `CLOUDINARY_*` env vars are set;
  otherwise they fall back to local disk (`backend/uploads/`) for local development only — this
  is not suitable for serverless/production hosting.

## Prerequisites

- Node.js 20+
- A MongoDB deployment that is a **replica set** — transactions and the reconciliation logic
  require it. The easiest options:
  - **MongoDB Atlas** (recommended, free tier works and is a replica set by default), or
  - a local single-node replica set:
    ```bash
    mongod --replSet rs0 --dbpath /path/to/data --port 27017
    # in a separate shell, one-time:
    mongosh --eval "rs.initiate()"
    ```

## Backend setup

```bash
cd backend
cp .env.example .env      # fill in MONGODB_URI at minimum
npm install
npm run seed               # creates demo project, floors, companies, allocations, gates, users
npm run dev                 # http://localhost:4000
```

`npm run seed` prints the demo login credentials it creates (super admin, project admin, an
entry gateman, an exit gateman, and a viewer), all scoped to a seeded "Hyderabad Business
Tower" project with the exact floors/companies/allocations from the spec's worked example.

Other useful scripts:

```bash
npm run typecheck     # tsc --noEmit
npm run reconcile      # recompute occupancy counters from ACTIVE sessions for all projects
npm run smoke-test     # spins up an in-memory MongoDB replica set and runs the
                        # concurrency/business-rule test suite described below — no
                        # external MongoDB needed
npm run build && npm start   # production build
```

### Verifying correctness without a real database

`npm run smoke-test` (in `backend/`) launches a throwaway single-node MongoDB replica set via
`mongodb-memory-server`, then exercises the entry/exit services directly and asserts:

- entry succeeds both with and without a vehicle number (spec §20, §57)
- a second entry with a vehicle number that's already active is rejected (spec §21)
- of two simultaneous entries for the last remaining slot, exactly one succeeds and the other
  gets `PARKING_FULL`, and occupancy never exceeds capacity (spec §22, §55)
- of two simultaneous exit requests for the same session, exactly one succeeds and the other
  gets `SESSION_ALREADY_COMPLETED` (spec §27, §56)

This is the fastest way to confirm the concurrency guarantees hold on your machine without
provisioning Atlas first.

## Frontend setup

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, defaults to http://localhost:4000
npm install
npm run dev                          # http://localhost:3000
```

Sign in with any of the seeded accounts. Role determines the landing page:

| Role            | Landing page       |
|-----------------|---------------------|
| SUPER_ADMIN     | `/admin/dashboard` (plus a project switcher in the top bar) |
| PROJECT_ADMIN   | `/admin/dashboard` (scoped to their assigned project) |
| VIEWER          | `/admin/dashboard` (read-only: no create/edit affordances in the nav) |
| ENTRY_GATEMAN   | `/gate/entry` — the fast vehicle-type → company → availability → optional plate → Allow Entry flow |
| EXIT_GATEMAN    | `/gate/exit` — search/filter active sessions and Confirm Exit |

## Manual test checklist (spec §64)

With both servers running and seeded data loaded:

1. Log in as `projectadmin@parking.local` → Floors/Companies/Allocations/Gates/Users pages all
   scope to the seeded "Hyderabad Business Tower" project.
2. Log in as `entry@parking.local` (assigned to Gate 1) → run a CAR entry for ABC Technologies
   with a plate number, then another without one — both should succeed.
3. Open a second browser window as `viewer@parking.local` on `/admin/dashboard` — occupancy
   updates there the instant the entry above is confirmed, with no refresh.
4. Reduce an allocation's capacity to match current occupancy in Allocations, then attempt
   another entry for it — you get "Parking is no longer available."
5. Log in as `exit@parking.local` (Gate 3), filter by company/vehicle type, confirm an exit for
   a vehicle that has no plate number on file (found via company/floor/entry time, not plate).
6. `npm run smoke-test` covers the two concurrent-request race conditions (§55, §56) that are
   impractical to trigger reliably by hand.
7. Settings → "Recalculate Occupancy" reconciles counters from ACTIVE sessions and audits any
   correction.

## Deployment

- **Frontend**: deploy `frontend/` to Vercel. Set `NEXT_PUBLIC_API_URL` to your backend's public
  URL.
- **Backend**: deploy `backend/` to any Node host (Render, Railway, Fly.io, a VM, etc. — Vercel
  serverless functions are not a good fit for a stateful Socket.IO server). Set `MONGODB_URI` to
  your Atlas connection string, real `JWT_*` secrets, `CORS_ORIGIN` to your Vercel domain, and
  `CLOUDINARY_*` for logo uploads. Because the frontend and backend will be on different
  registrable domains in production, auth cookies are automatically switched to
  `SameSite=None; Secure` in production (see `backend/src/controllers/authController.ts`).
- **Database**: MongoDB Atlas. Run `npm run seed` once against the production `MONGODB_URI` to
  bootstrap the super admin account (or create one manually), then change its password.

## What's intentionally out of scope for v1

Per the spec's extensibility section, these are designed for but not built in v1: QR/RFID/ANPR,
visitor/reserved/VIP/EV/employee/guest parking tiers, monthly passes, payments, SMS/WhatsApp
notifications, a native mobile app, individually numbered slots, and hardware barrier
integration. The data model (project → floor → company → allocation → session) leaves room for
all of these without a schema rewrite.
