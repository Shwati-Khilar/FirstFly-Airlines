# Lightweight seat concurrency benchmark

From `airline-system`:

```powershell
npm run benchmark:seats
```

Uses existing Node.js, mysql2 and bcrypt dependencies. No running Next.js server, Razorpay credentials, browser or new load-testing package is required. `.env.local` must specify the local MariaDB DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME. The account must be able to inspect the source schema and create/drop a temporary database, as with the integration tests. Remote database hosts are refused.

## What runs

1. Read SHOW CREATE TABLE for the five base tables in the configured database. No source rows are copied or mutated.
2. Create a uniquely named `firstfly_bench_<random UUID>` database, copy schema including constraints, and apply the existing migrations there.
3. Insert one dedicated bcrypt account with a random password, one test flight and one available Economy seat A4.
4. Start a loopback HTTP server on a random port using the actual shared login and booking handlers. First verify an anonymous lock request returns 401. Log in using the actual credential handler and retain its HTTP-only session cookie in process memory. Neither cookie nor password is printed.
5. Launch 20 HTTP seat-lock requests together using Promise.all, the authenticated cookie and 20 distinct reservation attempt UUIDs. This tests 20 competing attempts under one dedicated account rather than idempotent retries of the same attempt. The database pool size is ten, matching the application.
6. Require exactly one successful reservation and 19 HTTP 409 responses with error bodies. Other statuses, network failures or malformed success responses fail the benchmark with a nonzero exit code.
7. Check MariaDB directly: exactly one reservation, matching seat/owner/attempt IDs, active locked status, and no passengers, legacy bookings or payment records. No Razorpay module is invoked and no final booking is fabricated.
8. Close HTTP and database connections, then drop only the temporary database created by this invocation. The generated-name pattern and inequality to DB_NAME are checked first, and absence is verified afterward. Cleanup runs on ordinary failures too. An OS-level forced kill can leave a temporary database; the script never sweeps other databases.

The reservation batch executionMs excludes fixture creation, login, database verification and cleanup. totalRunMs includes those steps. The test exercises real HTTP, production shared handlers, bcrypt/session authentication and real MariaDB transactions, but not Next.js routing/server overhead, browser performance or payment/finalization throughput. It is a contention correctness check, not a capacity estimate.

## Actual results

| Metric | Run 1 | Run 2 |
| --- | ---: | ---: |
| Concurrent requests | 20 | 20 |
| Successful reservations | 1 | 1 |
| Conflicts (409) | 19 | 19 |
| Unexpected errors | 0 | 0 |
| Request batch time | 135.28 ms | 126.82 ms |
| Full run time | 580.34 ms | 583.54 ms |
| Reservation rows | 1 | 1 |
| Bookings / passengers / payments | 0 / 0 / 0 | 0 / 0 / 0 |
| Consistency and cleanup | Passed | Passed |

Files changed: scripts/benchmark-seats.mjs, package.json, docs/concurrency-benchmark.md. Existing reservation and payment logic is unchanged.
