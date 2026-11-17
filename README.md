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
- **Auth**: JWT access token (15 min, httpOnly cookie) + refresh token (configurable, httpOnly
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

- Node.js 22.x
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

`npm run seed` creates a super admin, a project admin, a gatekeeper, and a viewer, all scoped to a seeded "Hyderabad Business
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

### Password reset by registered email

The login page links to **Forgot password?**. Enter a registered work email and
select **Check email**. If it belongs to an active account, the same page displays
**New password** and **Confirm new password**. Saving updates the hashed password
and invalidates previous sessions. Unknown/inactive emails show an error.

This flow intentionally checks database membership only, as requested. It does
not prove email ownership: anyone who knows a registered address can reset that
account. An email delivery service, OTP, and email reset link are not required.
The temporary reset session expires after 15 minutes, works once, and is replaced
by a new email check. Only its token hash is stored in the database.

Run `npm run smoke-test:password-reset` in `backend/` for the integration tests.
If MongoDB Atlas cannot resolve through the system DNS server, configure the
optional `DNS_SERVERS` setting described in `backend/.env.example` and restart
the backend. Keep `NEXT_PUBLIC_API_URL` pointed at the running backend.

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
| GATEKEEPER | `/gate/security` for initial password/device MPIN setup, then `/gate/select` for entry or exit duty |

## Manual test checklist

See [HANDOFF_REVIEW.md](HANDOFF_REVIEW.md) for verified checks and remaining acceptance work.

1. Sign in as the project admin and confirm floors, companies, allocations, gates,
   and users belong to the assigned project.
2. Sign in as `gatekeeper@parking.local`. Change the temporary password when
   prompted, set or unlock the device MPIN, then select an entry gate for today.
3. Record one car entry with a plate and one without a plate. Verify receipts and
   live occupancy in a separate viewer session.
4. Check full allocation rejection, duplicate plate rejection, and QR/session-code
   lookup. Capacity cannot be reduced below current occupancy.
5. Wind up entry duty, select an exit gate, and complete both exits. Confirm slots
   become available and attendance counts the successful operations.
6. Verify reports for today's full business day, history filters, and CSV export.
7. In Settings, reconcile occupancy. Verify corrections and audit log entries.
8. Check a registered email, set a new password, and confirm sign-in with it.

The database connection now fails explicitly if the configured database cannot
be reached. For disposable local development only, set `ALLOW_IN_MEMORY_DB=true`
to opt into a temporary in-memory database. Its records do not survive restart.
Never use that option for client data. The default business timezone is
`APP_TIMEZONE=Asia/Kolkata`.

## Deployment

- **Frontend**: deploy `frontend/` to Vercel. Set `NEXT_PUBLIC_API_URL` to your backend's public
  URL.
- **Backend**: deploy `backend/` to any Node host (Render, Railway, Fly.io, a VM, etc. — Vercel
  serverless functions are not a good fit for a stateful Socket.IO server). Set `MONGODB_URI` to
  your Atlas connection string, real `JWT_*` secrets, `CORS_ORIGIN` to your Vercel domain
  (for example `https://frontend-wy5s.vercel.app`; comma-separate multiple origins), and
  `CLOUDINARY_*` for logo uploads. Because the frontend and backend will be on different
  registrable domains in production, auth cookies are automatically switched to
  `SameSite=None; Secure` in production (see `backend/src/controllers/authController.ts`).
- **Database**: MongoDB Atlas. Run `npm run seed` once against the production `MONGODB_URI` to
  bootstrap the super admin account (or create one manually), then change its password.
  Before allowing user accounts without a work email, run `npm run migrate:optional-email` from
  `backend/` once against the target database to replace the old unique email index with a sparse
  unique index.

## What's intentionally out of scope for v1

Per the spec's extensibility section, these are designed for but not built in v1: RFID/ANPR,
visitor/reserved/VIP/EV/employee/guest parking tiers, monthly passes, payments, SMS/WhatsApp
notifications, a native mobile app, individually numbered slots, and hardware barrier
integration. The data model (project → floor → company → allocation → session) leaves room for
all of these without a schema rewrite.
