# Repository cleanup — 4 November 2026

Scope: source/pages/API adapters, shared services, migrations, seed/setup/benchmark tools, tests, documentation, configuration, dependencies and local generated artifacts. Existing uncommitted feature work was preserved. No commit, push, history rewrite, branch deletion or customer-data modification was performed.

## Removed

- Unreferenced starter assets: `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`.
- `.vscode/settings.json`: local and hosted database connection metadata; no application dependency. Its prior versions remain in Git history.
- `tmp/`: old confirmation source snapshot, card/PDF screenshots, sample download, expected sample JSON and temporary Python QR-decoder installation.
- `output/pdf/`: generated sample PDFs, including samples regenerated successfully during cleanup verification.
- Direct `html2canvas` dependency; no application imports remain. jsPDF still has it as an optional transitive dependency. Lockfile updated.

## Retained

All working application files and API routes; six migrations; seed, audit, reconciliation, setup, measurement and concurrency scripts; tests; favicon; both embedded PDF fonts and their licenses; `.env.example`; setup/design documentation. Referenced JSON measurement/audit snapshots remain historical evidence, not current performance/security claims. TypeScript/type packages remain required by existing Next.js lint tooling, despite application source being JavaScript. Ignored `node_modules`, local `.env.local` and regenerated `.next` remain available for local development.

The useful temporary PDF checker was preserved as `scripts/verify-pdf-render.py`, with portable Poppler configuration and documented optional Python dependencies. Its syntax and JavaScript sample generation were checked; rendering/QR decoding was not repeated during this cleanup.

## Hygiene and security

Ignore rules cover local environments (except `.env.example`), editor settings, dependencies, build output, logs, Python caches, temporary files and output artifacts. README now reflects the previously verified PDF behavior and selected-date search.

Candidate scan: 101 files, including 98 text files. No configured-secret matches or tracked real environment files. All 13 reachable commits / 75 unique historical blobs were checked for configured-secret matches: none. A separate pattern scan of 70 historical text blobs found no private keys, provider tokens or literal credentials. Email matches were test fixtures and a login placeholder. This bounded scan is not a guarantee against all possible secrets or personal information; Git author identity and historic editor connection metadata remain in history.

Production `npm audit --omit=dev`: zero advisories on this run. Development advisory results in earlier documentation are historical and were not refreshed here.

## Verification

- Unit tests: 30 passed.
- Isolated MariaDB integration tests: 42 passed, including authentication, ownership, seat races, booking/finalization, cancellation, check-in and mocked payment failure/recovery.
- Empty-database setup: migrations twice, seed twice, 11 tables, 120 flights, 10,800 seats; no duplicate reseeding; registration/session/lock/release passed. Temporary database removed.
- Benchmark: 20 requests, 1 reservation, 19 conflicts, 0 unexpected errors, consistent state and verified cleanup. Request batch 171.57 ms; full run 742.84 ms. This is local shared-handler HTTP, not production throughput.
- Lint: zero errors; three existing Next.js image warnings.
- PDF sample generator: three one-page PDFs generated successfully; generated artifacts removed afterward.

Read-only customer-database audit still reports 5 duplicate active-seat groups, 26 missing owners, 19 unmatched seats, 17 booking/inventory mismatches and 7 expired locks; no duplicate PNRs or payment IDs. These pre-existing records were preserved. No live Razorpay checkout, physical printing or new authenticated browser end-to-end flow was tested during cleanup.

Production build: passed after rerunning with normal filesystem access following a Windows EPERM error creating generated files. Existing module-type warnings remain.

## Final pre-commit password-reset removal

Removed the unused reset feature and Nodemailer. Existing database tables/data were not dropped; migrations 000–005 are retained. The reset-only 006 migration is no longer needed by any application code. Fresh setups now create 11 tables; previously installed databases may retain the unused reset table. The login page already contained neither reset text nor a reset link and was not edited in this cleanup.

Exact files removed:

- `app/api/auth/forgot-password/route.js`
- `app/api/auth/reset-password/route.js`
- `app/forgot-password/page.js`
- `app/reset-password/page.js`
- `app/components/PasswordResetForm.jsx`
- `lib/password-reset.js`
- `lib/reset-mail.js`
- `migrations/006-password-reset.sql`
- `tests/password-reset.test.mjs`
- `tests/password-reset.integration.mjs`
- `docs/password-reset.md`

Exact files modified:

- `.env.example`
- `README.md`
- `package.json`
- `package-lock.json`
- `docs/seat-reliability.md`
- `lib/auth.js`
- `lib/booking-pdf.js`
- `lib/checkin-handler.js`
- `lib/http.js`
- `migrations/000-base.sql`
- `public/pdf-fonts/OFL-Cormorant.txt`
- `public/pdf-fonts/OFL-DMSans.txt`
- `scripts/reservations-db.mjs`
- `scripts/verify-booking-pdf.mjs`
- `scripts/verify-setup.mjs`
- `tests/reservations.integration.mjs`
- `docs/repository-cleanup.md` (this inventory)

The .env.example, README and package manifests remove reset/email configuration and claims. All other listed source, SQL, license and tool edits are whitespace-only: trailing spaces and surplus blank lines at EOF. License text is preserved. Affected paths were updated in the existing staged changes; no commit or push was performed.

Verification: 30 unit tests including authentication and 42 isolated MariaDB integration tests passed; fresh setup with migrations/seed twice passed (120 flights, 10,800 seats). Lint passed with zero errors and three existing image warnings. Staged and working-tree whitespace checks passed. README links and absence of remaining reset-code/Nodemailer references were checked.

Production build passed after a Windows EPERM retry with normal filesystem access; the generated route inventory contains no password-reset pages or endpoints.
