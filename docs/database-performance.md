# Focused database query optimization

## Changes

Migration `005-query-indexes.sql` adds exactly three nonunique indexes:

- `flights_origin (current_location)` for origin-only and combined route searches.
- `flights_destination (desired_location)` for destination-only searches; MariaDB can intersect the two city indexes for a combined route.
- `passengers_owner (user_id)` for authenticated My Trips. InnoDB secondary indexes include the primary key `id`, allowing the existing `ORDER BY id DESC` without a redundant explicit ID index.

No rows, foreign keys, booking logic or payment logic were changed. The migration was applied locally. Full-row fingerprints across flights, seats, passengers, users and bookings matched before/after.

Seat availability already uses `seats.unique_flight_seat(flight_id,seat_number)`, `passengers_flight(flight_id)` and `bookings.fk_seat(seat_id)`. Added no redundant seat indexes. Existing normalization/legacy checks in availability remain intact; a raw seat/status index cannot resolve those expression predicates. Point booking and cancellation queries already have primary/PNR indexes.

Flight filtering now happens in parameterized SQL shared by the page and API. City comparisons use the existing case-insensitive database collation, with trimmed inputs. Inspection found no whitespace-padded existing city values. Avoiding functions on indexed columns keeps equality predicates indexable; future imports must supply trimmed city values.

Pages contain 12 flights ordered by unique flight_code, fetching 13 to determine whether Next exists. Previous/Next preserve origin/destination. No COUNT(*) query is needed. Invalid page/city inputs are rejected; page is capped at 100000. OFFSET is intentionally simple for this dataset; deep paging remains linear in the offset and cursor pagination is a future option.

`GET /api/flights?from=Delhi&to=Mumbai&page=2` retains its array response, with `X-Page`, `X-Page-Size` and `X-Has-Next` headers. Without an ID it now defaults to the first page, rather than returning every flight. `?id=101` remains an unpaginated one-flight array with fares. Existing booking/status consumers use ID lookup. The rendered search page uses the same service directly. My Trips remains unpaginated so confirmation can continue resolving any owned booking.

Flight queries now name their eight public columns explicitly. This currently equals the eight-column table, so no column-projection speedup is claimed. Bounded result rows are the material improvement. Internal transaction SELECT * queries were left intact because they use reservation and lock metadata.

## Measurement

`docs/query-performance-results.json` contains actual EXPLAIN plans and timings before/after the migration on the same 140-flight dataset. One local mysql2 connection, five warmups, 50 sequential executions per query, no forced index or artificial data, and full result transfer included. Median and p95 use sorted sample positions 25 and 47 (zero-based). Tests are cache-warm and small; machine noise and query-plan overhead dominate. No percentage gain is claimed.

| Query | Median before (ms) | Median after (ms) |
| --- | ---: | ---: |
| Origin page | 0.318 | 0.329 |
| Destination page | 0.440 | 0.385 |
| Combined route | 0.299 | 0.584 |
| Unfiltered page | 0.247 | 0.174 |
| My Trips | 0.196 | 0.252 |

Several indexed queries were slower in this small run. The route plan uses index intersection plus a filesort; this is not evidence of improved latency. The indexes provide selective access paths as rows grow, at the cost of index space/write maintenance. Do not infer production throughput from these numbers.

The previous unbounded query returned 140 rows; the new first-page query returns at most 13, displaying 12. Origin/destination plans changed from primary-index filtering to city-index lookups. My Trips changed from scanning an estimated 36 passenger rows to a user-index lookup estimating four. EXPLAIN rows are optimizer estimates, not measured scanned-row counts.

## Reproduce

```powershell
npm run db:migrate
node --env-file=.env.local scripts/measure-queries.mjs
npm test
npm run test:integration
npm run lint
npm run build
```

Measurement without flags is read-only against MariaDB and overwrites the local results JSON. On a pre-migration copy, `node --env-file=.env.local scripts/measure-queries.mjs --apply` measures, applies only migration 005, then measures again. Running it against an already migrated database measures the indexed state twice; it never drops indexes to recreate a baseline.

Verification: 24 unit tests and 42 isolated MariaDB integration tests passed. Read-only pagination checks traversed all 140 flights over 12 pages without gaps or duplicates and checked destination-only filtering. Total seat inventory remains 12,600.

Files: migration 005, lib/flight-search.js, app/flights/page.js, app/api/flights/route.js, scripts/measure-queries.mjs, tests/flight-search.test.mjs, integration fixture schema, this document and the results JSON.

Lint completed with zero errors and four existing warnings. Production build completed successfully. No browser testing was performed for this change.
