# Seat and booking reliability

Payment-phase follow-up: see [payment-workflow.md](payment-workflow.md) for the newer webhook, reconciliation, passenger-snapshot and checkout contracts. Statements below about missing webhooks describe the original seat-reliability phase.

Implemented on `firstfly-reliability-improvements`. JavaScript, mysql2 and MariaDB remain in use; no new packages.

## Verified local results (2026-11-01)

- 7 focused tests passed; 23 real-MariaDB integration tests passed.
- Lint passed with 0 errors and 6 warnings in unrelated files (unused imports and existing image usage).
- Production build passed with network access for the existing Google Fonts dependency. The initial sandboxed build failed specifically on those downloads.
- Production HTTP smoke checks passed: home/login/booking/trips render; availability returns 90 seats without owner/token fields; malformed requests return 400; all six protected write routes and booking history reject missing sessions, including forged client IDs.
- The migration was applied to the configured LOCAL database. SHA-256 comparisons of every original column/row in all five existing tables were identical before and after. Both added tables were empty immediately after migration.
- Temporary integration databases were dropped after the suites. No real payment or mutating customer-data HTTP test was performed. Visual browser interaction was not tested.
- Restart the application and sign in again to use the new server session. Other environments still require the migration.

## File inventory

Requested files changed:

```text
app/api/seats/lock/route.js
app/api/seats/get/route.js
app/api/seats/release/route.js
app/api/seats/confirm/route.js
app/api/book/route.js
app/api/book/cancel/route.js
app/book/[id]/page.js
lib/db.js
```

Related existing files changed to support trusted ownership, verified payment and persistent cancellation:

```text
app/api/auth/login/route.js
app/api/auth/register/route.js
app/api/bookings/route.js
app/api/payment/route.js
app/api/checkin/route.js
app/components/Navbar.jsx
app/my_trips/page.js
package.json
```

Added files:

```text
app/api/auth/me/route.js
app/api/auth/logout/route.js
lib/auth.js
lib/booking-handlers.js
lib/booking-runtime.js
lib/http.js
lib/payments.js
lib/reservations.js
lib/transaction.js
migrations/001-reservations.sql
scripts/reservations-db.mjs
tests/booking.test.mjs
tests/reservations.integration.mjs
docs/seat-reliability.md
```

## Deployment

Stop old application instances before switching to this version. Old endpoints bypass the new invariants and must not remain deployed alongside it.

From the airline-system directory, using Node 24 (the tested runtime):

```powershell
npm run db:audit
npm run db:migrate
npm test
npm run test:integration
npm run build
npm start
```

The database commands load `.env.local`. On another environment, provide its existing DB_* configuration appropriately. Migration is additive and rerunnable: it creates `auth_sessions`, `reservation_attempts`, a nullable `seats.lock_attempt_id`, and nonunique passenger lookup indexes. DDL is not transactional; a partial migration can be rerun. It does NOT rewrite/delete passenger records or impose new uniqueness on legacy passenger data. Back up the database under your normal deployment procedure before schema changes.

Users must sign in again. Browser-stored user IDs no longer authorize anything. Sessions are opaque random tokens, stored hashed in MariaDB and sent in HttpOnly/SameSite cookies (Secure in production). Logout deletes the server session. Production must use HTTPS. An origin check rejects cross-origin writes; reverse proxies must preserve the request's public origin. Expired sessions are rejected but not automatically purged.

Razorpay must capture payments: finalization requires provider status `captured`, matching persisted order, amount, currency and signature. No real charge is required for automated tests. The gateway remains in the mode configured by existing environment variables.

## One authoritative workflow

1. Lock a seat using a browser-generated UUID v4 attempt ID and the authenticated session.
2. Server locks the seat row (`FOR UPDATE`), checks existing legacy bookings, derives the fare from flights, creates an attempt and grants a five-minute lease.
3. Order creation uses the persisted attempt fare. External provider calls happen outside transactions. A short second transaction attaches the order only while the reservation remains active.
4. `/api/book` and `/api/seats/confirm` are aliases of ONE finalization handler. Neither should be called as an additional insertion step.
5. Validate checkout signature against the persisted order; fetch payment from Razorpay outside the transaction.
6. In one transaction, lock seat/attempt, validate active ownership/expiry and payment, claim unique PNR/payment, insert passenger, mark seat booked, clear all lock metadata, and link the confirmed attempt.
7. Repeating finalization with the same attempt/payment returns the same booking. A cancelled attempt never resurrects. New confirmed attempts have a generated unique seat key; cancellation clears that key through its state transition.
8. Cancellation locks and validates the owned booking's actual seat, marks passenger and attempt cancelled, and releases inventory in one transaction. Repeating cancellation returns success without releasing inventory again.

The unused legacy `bookings` table is not repurposed. Existing passenger records remain the booking-history source. The attempt ledger supplies idempotency and unique payment/PNR/confirmed-seat constraints for new work.

## API contract

All writes below require the session cookie. Supplied `userId` and `user_id` are ignored. JSON errors are sanitized; validation returns 400, missing session 401, missing record 404, conflicts 409.

- Lock: `POST /api/seats/lock` with `{flightId, seatNumber, attemptId, travelClass}`. Returns `{success, attemptId, price, expiresAt}`. Same active attempt is idempotent and does not extend expiry.
- Order: `POST /api/payment` with `{flightId, seatNumber, attemptId}`. Returns `{id,amount,currency}`. Amount is paise; client `amount` is ignored.
- Finalize: `POST /api/book` OR `/api/seats/confirm` with `{flightId,seatNumber,attemptId,name,age,gender,razorpay_order_id,razorpay_payment_id,razorpay_signature}`. Returns `{success,pnr,bookingId,price,attemptId}`. Class, price and owner come from the persisted attempt.
- Release: `POST /api/seats/release` with `{flightId,seatNumber,attemptId}`. Returns `{success,released}`. It cannot release another owner/flight/attempt or booked inventory. A stale release after another attempt acquires the seat is a no-op.
- Cancel: `POST /api/book/cancel` with `{bookingId}` (preferred). Legacy `{pnr,seat,flightId}` is supported only when the user's PNR identifies exactly one record and supplied fields match. Returns cancelled status; first cancellation also reports `refundStatus: not_processed`.
- Availability: `GET /api/seats/get?flight=...` returns public seat fields only. It performs NO writes. Expired genuinely locked seats are logically available unless legacy bookings block them. Acquisition replaces an expired lock atomically. No global expiry sweep exists.
- History: `GET /api/bookings` uses session identity; query `userId` is ignored.
- Session: `GET /api/auth/me`, `POST /api/auth/logout`; login/register retain their `{user}` response and additionally set a session cookie.

Canonical labels are `A1` through `F15`; `seat` and `seatId` remain text-label aliases. Numeric database seat IDs are not accepted as `seatId`. Conflicting aliases are rejected. Rows 1–3 are Business; rows 4–15 Economy, preserving the existing layout. Business fare is rounded to whole rupees at 1.5 × flight.price because current passenger prices are integers.

## Legacy data safety

Read-only preflight found: 5 duplicate active flight/seat groups, 26 passenger records without an owner, 19 without an exact seat match, 7 expired locks, and 17 active passenger records matching non-booked inventory. These counts are a snapshot, not evidence of how the records arose.

No automatic customer-data remediation occurs. Active passenger rows protect their seats even if seats says available. Known row-first labels such as `4A` are matched to `A4` without modifying storage. Unknown/null seat labels conservatively block the flight. Duplicates, ambiguous PNRs, conflicting legacy bookings-table rows and live lock conflicts require manual review. A sole owned legacy booking with a resolvable seat can be cancelled safely. Unowned records cannot be claimed using a supplied user ID.

Do not add passenger unique indexes or mass-update legacy status/labels before reviewing and resolving those records with approval. New invariants assume all booking writes go through these handlers, not old application versions or direct SQL.

## Current recovery behavior

See [payment workflow](payment-workflow.md), [authentication](authentication.md) and [frontend reliability](frontend-reliability.md) for the final implementation. Webhooks and CLI reconciliation are implemented; refunds and legacy data repair remain manual. Confirmation loads authenticated server data. The five-minute lease is enforced even after payment capture; late captures require review.

## Test isolation

`npm test` runs focused validation, transaction, signature and handler tests with mocks.

`npm run test:integration` connects only to a local DB_HOST, creates `firstfly_test_<random UUID>`, builds fixture tables, applies the actual migration twice, and tests real InnoDB concurrency/rollback behavior. It never selects DB_NAME as its test database. Cleanup verifies the generated name before dropping only that database. The database account needs CREATE/DROP DATABASE and trigger privileges. If the process is forcibly killed, its uniquely named test database may remain for manual inspection.

Integration coverage includes simultaneous locks, duplicate lock/finalization, expired and booked-seat protection, scoped/stale release, payment validation/reuse, injected update failures, cancellation/rebooking, legacy conflicts, session expiry/revocation, and both finalization HTTP handlers. Gateway calls are mocked, with assertions that no transaction is held during them.
