# Demo flight dataset

Run from `airline-system` with the existing MariaDB `.env.local` configuration:

```powershell
npm run db:seed:demo
```

Optional first-run departure date:

```powershell
npm run db:seed:demo -- 2026-12-01
```

Default: seven days after the day the script first runs, spread over ten departure dates. All generated schedule strings and registry DATETIME values are local **Asia/Kolkata (IST)** wall-clock times. The existing VARCHAR(20) schedule columns are preserved; generated strings use `YYYY-MM-DD HH:mm` (16 characters). Existing time-only schedules are untouched.

The dataset adds 120 flights across 12 Indian cities with five recognizable airline labels: IndiGo, Air India, Air India Express, SpiceJet and Akasa Air. Airline names are illustrative labels, not affiliations or actual airline schedules. Cards explicitly identify generated schedules using the seed registry. Geographic distance drives plausible flight duration and Economy fares; these are demonstration prices, not market quotes. Each flight has 90 seats labelled A1–F15: rows 1–3 Business (18 seats), rows 4–15 Economy (72 seats). The existing application determines cabin pricing; booking/payment logic is unchanged.

`demo_flights` records stable versioned seed keys, flight IDs, dated schedules and timezone. New flight IDs are 900001–900120. If an unrelated existing flight occupies an ID, the entire insertion transaction rolls back rather than overwriting it. A MariaDB advisory lock serializes simultaneous seed runs. Flight, registry and seat inserts commit together; schema creation is additive and outside that transaction.

Reruns preserve registered flights, including any booked or locked seats. The only label update replaces an exact original DEMO carrier name on a matching versioned registry-owned flight with its deterministic recognizable airline label. Custom labels and non-seeded flights are untouched. They do not move dates forward, reset fares, fill deleted seats, or overwrite user changes. An alternative start date only affects records being created for the first time. This script seeds inventory only: it creates no users, passengers, bookings, payments or simulated purchases. Bookings subsequently made against demo inventory remain real application activity and are not erased by seeding.

Existing repository SQL files were migrations; no earlier reusable flight dataset seed file was found. MariaDB inspection showed 20 original flights with 1,800 seats before execution.

Verified locally: first execution added 120 flights; immediate rerun added zero. Final counts queried directly from MariaDB: **140 flights; 12,600 seats**, including **120 demo flights and 10,800 demo seats**. Every original row in flights, seats, users, passengers and bookings was compared before/after and preserved. All 120 demo flights have exactly 90 seats.

Files: scripts/seed-demo.mjs, migrations/004-demo-flights.sql, tests/demo-seed.test.mjs, package.json, docs/demo-dataset.md. No booking/payment logic changed.

## Flight card presentation update (2026-11-03)

All 120 original generated labels were renamed through the seed registry (24 flights per airline); a second run renamed zero and inserted zero. Comparisons verified that non-seeded flights and all other fields/records in flights, seats, passengers, bookings and users were unchanged. Totals remain 140 flights and 12,600 seats.

Cards separate departure/arrival dates and 12-hour times. Stored Indian wall-clock strings are parsed explicitly without timezone conversion; legacy time-only schedules display Date not specified. All 140 existing/seeded schedules parsed successfully. Airport codes represent the listed cities (Goa uses GOI); the project does not contain authoritative airport-level operational data.

Verification: 27 unit tests, 42 isolated database integration tests, clean setup verification and production build passed. Lint: zero errors, three pre-existing image warnings. Headless Edge checked card overflow at 1440/768/375/320 px; all 140 cards across 12 pages passed at 320 px. The mobile card screenshot was visually inspected. Destination-only search, pagination, booking navigation and seat-map loading passed. No payment or actual reservation was made in browser checks.
