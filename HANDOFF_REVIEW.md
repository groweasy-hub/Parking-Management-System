# Client handoff review - 16 October 2026

## Subsequent password recovery requirement

The user subsequently requested database email matching followed immediately by
a new-password form, without an email link or code. This replaces the original
inbox reset workflow described by the initial review. Email delivery settings are
no longer required for password recovery. This intentionally does not prove
ownership of the email address: knowing a registered email permits its password
to be reset. Reassess that tradeoff before exposing the app publicly.

The local backend's MongoDB DNS failure was reproduced and resolved with an
explicit `DNS_SERVERS` override. Its health endpoint is available on port 4000.

Automated validation passed. Deployment configuration and manual browser/device
acceptance remain before calling the deployed application ready for the client.
All database tests used temporary databases; client records were not modified.

## Validation

| Check | Result |
| --- | --- |
| Backend TypeScript production build | Passed |
| Frontend ESLint | Passed with no errors or warnings |
| Frontend production build and TypeScript | Passed; all application routes generated |
| Production HTTP route/asset checks | 20 page routes and 16 referenced assets passed |
| Parking service smoke tests | 10 passed, 0 failed |
| HTTP authentication, gate entry and exit tests | 11 passed, 0 failed |
| Password reset integration tests | Passed |
| Full handoff integration tests | 102 checks passed |

Run from `backend/`: `npm run build`, `npm run smoke-test`,
`npm run smoke-test:http`, `npm run smoke-test:password-reset`, and
`npm run smoke-test:handoff`. Run from `frontend/`: `npm run lint` and
`npm run build`.

## Corrections made

- Authentication checks the current account and revokes previous access and
  refresh tokens after password changes, resets, or account deactivation.
  Temporary gatekeeper passwords must be changed before operations are allowed.
- Project managers cannot change manager credentials; viewers cannot open
  management pages through direct URLs or the mobile navigation. Project detail
  access is restricted to the assigned project.
- Ended gate duties cannot record entries/exits. They can be resumed, and switching
  to a different gate requires ending the previous duty. Gate type changes are
  blocked while a duty is active.
- Allocation changes check the correct project/company, prevent concurrent floor
  over-allocation, and prevent capacity reductions or deactivation while vehicles
  still occupy the allocation. Floor capacities cannot fall below allocated spaces.
- Report aggregations use MongoDB ObjectIds. Date filters include the entire
  selected business day, reject invalid/reversed ranges, and default to India time
  (`APP_TIMEZONE=Asia/Kolkata`). Attendance uses the same business date.
- CSV downloads use authenticated API requests and honor plate/date filters.
  Literal searches accept punctuation without turning it into a regular expression.
- Live Socket.IO tests verify authorized room joins, denied cross-project joins,
  entry/exit broadcasts, and disconnection after deactivation. The frontend uses
  current tokens for reconnection and preserves shared project subscriptions.
- Reconciliation locks the parking counter before recounting, avoiding overwriting
  concurrent parking operations. Project deletion also removes attendance records.
- Setup wizard Back/retry actions update existing records. Company allocation
  retries can complete after a partial failure. Loading/upload errors have usable
  messages. Local logo paths resolve against the backend.
- Existing fonts are bundled locally, with their OFL licenses, so production
  builds do not depend on Google Fonts connectivity. Mobile pinch zoom is enabled.
- Database outages fail explicitly by default. A disposable development fallback
  requires `ALLOW_IN_MEMORY_DB=true`; startup checks replica-set support.
  The backend development command works across operating systems.

## Deployment and manual acceptance still required

The local `backend/.env` has database/JWT/CORS settings, but these are missing
locally: `FRONTEND_URL`, `PASSWORD_RESET_WEBHOOK_URL`, and all `CLOUDINARY_*`
settings. This review did not inspect the hosting provider's environment.

1. Confirm the chosen email-only recovery behavior with the client and complete
   one password reset using a registered email on the deployed application.
2. Configure Cloudinary for persistent logo storage on ephemeral hosting, or use a
   deliberately provisioned persistent disk. Local filesystem fallback alone is
   not persistent on hosts that replace their filesystem on redeployment.
3. Confirm the deployment uses Node.js 22, `NODE_ENV=production`, a MongoDB replica
   set, correct API/CORS addresses, and real JWT secrets.
4. On desktop and the intended gatekeeper phone, check sign-in, password change,
   device MPIN setup/unlock, gate selection, entry receipt, exit, and logout.
   Open a second session to confirm visible dashboard updates.
5. Check camera QR scanning with device permissions and receipt printing on the
   actual printer. Physical barrier control is not implemented; recording an entry
   does not operate barrier hardware.

Browser automation was unavailable: neither Chrome nor the in-app browser could
be opened through the provided browser tools. Consequently, rendered UI behavior,
MPIN interaction, camera permissions, printer output, production email delivery,
and deployment-specific cookie behavior have not been certified by this review.
