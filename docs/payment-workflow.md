# Razorpay payment workflow

## Changes

`app/api/payment/route.js`, `app/api/book/route.js` and the compatibility `/api/seats/confirm` route delegate to the shared handlers/runtime. `/api/payment/reconcile` is authenticated; `/api/payment/webhook` authenticates the exact raw body with a separate webhook secret.

Payment modules: `lib/payment-config.js`, `payments.js`, `payment-flow.js`, `payment-store.js`, `webhook-handler.js`. Reservation preparation in `lib/reservations.js` persists passenger details before creating an order. `app/book/[id]/page.js` persists the attempt before checkout, distinguishes pending/review from confirmed, and supports checking status, resuming the same order and explicit release.

`migrations/002-payments.sql` adds passenger snapshots, order-creation state, reconciliation timestamps, `payment_records`, and `payment_webhook_events`. `scripts/reservations-db.mjs` applies numbered additive migrations in order. No customer records are deleted, relabelled or marked paid by migration. Existing confirmed attempts can read their passenger details from the linked booking. Incomplete historical attempts require review.

## Security and consistency

- Fare comes from the server's flight price and validated cabin row/class, snapshotted in the reservation. Browser amount, class changes after preparation and user IDs cannot override it. Existing whole-rupee pricing is preserved.
- One attempt claims order creation before contacting Razorpay. A timeout or DB failure leaves creating/uncertain state. A retry searches provider orders by the attempt receipt; it does not blindly create another order. Multiple matches require review.
- Orders must match the stored amount, INR currency, receipt and attempt note. Checkout uses the public key returned by the configured server, never the API secret.
- Checkout HMAC is computed with the stored order ID. `timingSafeEqual` rejects unequal digests before the official SDK verification is called. The installed SDK itself uses ordinary string equality, hence the explicit constant-time guard.
- The server fetches the payment from Razorpay and validates payment/order IDs, amount, currency, status, captured flag and refunded amount. Only a captured, unrefunded payment can finalize a reservation.
- The verified payment is recorded durably BEFORE finalization. Booking creation, unique payment/PNR claims and seat transition remain transactional and idempotent. A failure leaves recoverable payment evidence; no SQL transaction spans provider calls.
- Signed callback replays for an existing booking are idempotent even during a provider outage. Recorded refund/review cases take precedence. Fresh provider state is checked by reconciliation/webhooks.
- Webhooks verify raw bytes before parsing or doing database work, have a 1 MiB limit, deduplicate by signed-body hash, and re-fetch provider entities. The unsigned event-ID header is stored for diagnostics but is not the sole deduplication authority. Failed DB/provider work is not acknowledged as processed.
- Captured payments after expiry/release/cancellation, extra captures and refunds are recorded for review. No seat is stolen, no booking is silently resurrected, and no refund is fabricated.
- Provider exceptions are sanitized and never logged verbatim. Production contains no test gateway or hardcoded credential.

## Environment setup

Keep credentials in ignored `.env.local` or deployment secret storage:

```dotenv
RAZORPAY_KEY_ID=<your test or live public key ID>
RAZORPAY_KEY_SECRET=<the matching API secret>
RAZORPAY_WEBHOOK_SECRET=<separate random secret, at least 16 characters>
```

The existing `NEXT_PUBLIC_RAZORPAY_KEY_ID` is accepted as a fallback. If both key-ID variables exist, they MUST match. The new checkout receives the public key from the server; the API secret and webhook secret must NEVER have a `NEXT_PUBLIC_` prefix. Missing/invalid configuration fails safely with 503. Webhook configuration is validated separately when webhooks are received.

Set automatic capture in Razorpay for this integration. Authorized/pending payments do not issue tickets. Use test-mode keys and test-mode webhooks together; repeat setup independently for live mode.

From the project directory:

```powershell
npm run db:audit
npm run db:migrate
npm test
npm run test:integration
npm run build
npm start
```

Restart old application instances; mixed old/new payment handlers are unsupported. Sign in using the server session from the previous phase. Configure the gateway before attempting checkout. No credentials are generated or printed by the setup scripts.

## Local webhook setup

1. Run the app locally and expose its port through a Razorpay-accepted HTTPS tunnel or staging host. Check the linked validation guide: several common tunnel domains are blocked, and localhost cannot receive provider deliveries directly.
2. In Razorpay's TEST dashboard, add `https://<your-tunnel-host>/api/payment/webhook`.
3. Configure the same independent webhook secret as `RAZORPAY_WEBHOOK_SECRET` in the app. Do not use the API key secret.
4. Subscribe to `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, and `refund.failed`.
5. Restart after environment changes, complete a test checkout, and inspect delivery logs. A webhook needs no browser/session cookie. Invalid signatures are rejected; provider/database failures are retryable, not false acknowledgements.

Sources: [Razorpay Node verification helpers](https://github.com/razorpay/razorpay-node/blob/master/documents/paymentVerfication.md), [Razorpay order API](https://github.com/razorpay/razorpay-node/blob/master/documents/order.md), [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [refund webhook events](https://razorpay.com/docs/webhooks/refunds). Installed SDK 2.9.6 implementation was inspected as well.

## Reconciliation and support

The authenticated browser can POST `{flightId,seatNumber,attemptId}` to `/api/payment/reconcile`. It can only inspect its owner's attempt. States: `confirmed` (200), `pending` (202), `failed` (402), or `review` (409). These are business states, not assertions that a payment was refunded. The UI navigates to confirmation only for an explicit confirmed result containing a PNR.

Run an operator batch (up to 50 least-recently-checked attempts):

```powershell
npm run payments:reconcile
npm run payments:reviews
```

For one specific attempt:

```powershell
node --env-file=.env.local scripts/reconcile-payments.mjs <attempt-uuid>
```

Run batches periodically with your existing scheduler if unattended recovery is needed. No scheduler is installed automatically. The reviews command is read-only; it lists IDs/reason codes, not passenger details or secrets. Reconciliation can finalize verified eligible bookings, so it is an operator action, not merely a status report. Do not publish these CLI functions as unauthenticated endpoints.

## Verified implementation checks (2026-11-02)

- Unit tests: 14 passed. Isolated MariaDB integration tests: 39 passed; temporary test databases were removed.
- Production build passed. Lint completed with no errors and six existing warnings in unrelated files.
- The additive local migration completed. Before/after hashes of all original columns in the seven existing tables matched; no existing customer values changed.
- Local webhook configuration still needs a valid independent secret and Razorpay dashboard setup. No real Razorpay charge or provider webhook delivery was tested.

## Operational limitations

- Refund execution and operator review resolution are manual. Confirm provider state before refunding; this task does not initiate refunds or implement chargeback handling.
- If the provider accepted no order but the process died after claiming creation, the attempt stays unresolved instead of risking a duplicate order. Review/cancel it and start a new reservation only after checking provider state.
- A webhook or reconciliation arriving after the five-minute lease cannot finalize a new booking, even for a real capture. It creates a durable support case. Existing confirmed bookings remain idempotent.
- Provider receipt lookup is bounded to 100 matching orders. Multiple matches require review. Webhooks rely on public reachability, configured secrets and provider retries; the CLI provides recovery when deliveries are missed.
- Batch reconciliation currently revisits historical attempts to detect late refunds and captures; retention, rate limiting and scheduling are future operational work.
- Browser recovery is per-tab sessionStorage. Clearing it does not erase the server attempt/payment records. Webhooks and the operator command still recover server-side.
- The automated provider is test-only. Tests exercise real MariaDB transactions and the actual SDK signature helpers, but do not perform a real Razorpay charge or real provider webhook delivery.
