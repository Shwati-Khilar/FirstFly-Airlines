# Server-side authentication

## Strategy and flow

Opaque 256-bit random session tokens are sent only in a host-only HTTP-only cookie. MariaDB stores SHA-256 hashes in auth_sessions, linked to users, with a fixed seven-day expiry. This makes logout revocation immediate and avoids signing secrets or a new authentication dependency. Login and registration use bcrypt; session creation and replacement occur in a transaction. Logging in rotates the presented session. Other devices remain signed in.

Cookies use Path=/, SameSite=Lax, Max-Age=604800, and Secure in production. Production must use HTTPS. Local development uses HTTP via npm run dev. /api/auth/me supplies UI identity; localStorage is never an authentication source. Old display data is removed at login/logout. No password or token is written to browser storage.

Booking history, creation, seat locking/release, checkout/reconciliation, cancellation and check-in derive identity from the session. Ownership remains checked inside reservation transactions and payment lookup. Check-in requires both owner and booking details. Public seat availability stays public and does not expose lock owners. Webhooks use their independent signature authentication.

Origin and Sec-Fetch-Site checks reject cross-site mutations, combined with SameSite cookies. Non-browser clients without these headers must still supply a valid session. Reverse proxies must preserve the public request origin. Errors omit SQL, passwords and tokens. Account-not-found and wrong-password login errors are identical, including bcrypt work for missing accounts.

## Abuse protection

Migration 003-auth.sql adds only auth_rate_limits. Atomic shared counters permit 15 validated login/register attempts per normalized email and 300 total per 15-minute window. Limits apply to successes too and return 429 with Retry-After. No client-controlled IP header is trusted. These conservative project defaults need tuning under real traffic. Global/account limits can be deliberately exhausted; use trusted ingress IP limits and monitoring before public launch. Expired buckets reset on use; periodically remove expired rate-limit rows and expired sessions for storage housekeeping.

## Changed files

- lib/auth.js: rotate/revoke previous session, logout cache prevention.
- lib/credentials.js: shared credential validation, bcrypt, rate limits, safe errors and atomic sessions.
- app/api/auth/login/route.js and register/route.js: shared handler.
- lib/http.js: cross-site Fetch Metadata rejection and uncached known errors.
- lib/checkin-handler.js and app/api/checkin/route.js: authenticated owner-scoped lookup.
- app/login/page.js: removes localStorage user write; preserves layout.
- migrations/003-auth.sql: additive shared counters.
- tests/auth.test.mjs and tests/reservations.integration.mjs: authentication and authorization coverage.

Local migration has been applied. For other environments, run npm run db:migrate before deploying and restart the application. No new secrets or dependencies are required.

## Verification and limitations

Unit tests: 18 passed. Dedicated temporary MariaDB integration tests: 42 passed. Tests cover expiry, forged sessions, revocation, rotation, bcrypt login, generic failures, throttling/reset, unauthorized protected writes, check-in owner scoping, cancellation ownership, reservation ownership and payment ownership. No tests write customer bookings.

Registration duplicate responses remain HTTP 409 with generic text, so account existence can still be inferred from success versus failure. Email verification, password reset, MFA, global logout and a persisted check-in state are not implemented. The current check-in feature retrieves an authorized booking; it does not claim to record boarding/check-in completion. Existing ownerless legacy bookings remain inaccessible and require explicit review rather than assigning them automatically.
