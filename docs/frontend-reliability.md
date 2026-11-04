# Frontend reliability changes

- Updated all eight requested pages/components, plus globals.css, the flights API, lib/frontend-model.js and tests/frontend.test.mjs.
- Seat labels stay A1–F15; rows 1–3 are Business and 4–15 Economy. Selection uses tested canonical parsing. Availability is fetched from the database API every 15 seconds; unavailable/missing seats cannot be selected and stale selections are rejected before checkout. Server locking remains authoritative.
- Booking uses flight details and cabin fares from the flights API; checkout still uses the server-persisted reservation amount. No URL fare is trusted. The flight list no longer substitutes a hardcoded fare or depends on a configured self-fetch URL.
- Destination-only and origin-only searches work independently. Invalid flight IDs receive safe API errors.
- Confirmation fetches the signed-in user's bookings and resolves only an active booking by PNR. URL name, fare, seat and itinerary parameters are ignored. Links from booking/check-in/trips pass only the PNR. The document is labelled Booking Confirmation because the project does not implement an operational boarding/check-in state.
- My Trips filters Active, Cancelled and History; unknown legacy statuses are not displayed as confirmed. Reliable dated departures are unavailable, so an Upcoming label would be misleading. Removed inactive filter/sort/load-more controls. Cancellation has an immediate duplicate-request guard.
- Check-in asks for the full passenger name exactly as booked, trims/encodes input, handles network/API failures, and guards repeated requests.
- Broken /bookings and /my-trips links now use /my_trips. Navbar account menu exposes expanded state. Keyboard access was added to seat/class selection, destination cards and search swap; focus visibility, reduced motion and narrow-screen booking/ticket layouts improved.
- Status presents stored schedule data and explicitly labels map, telemetry, weather, gate and countdown panels as simulated. Removed inactive map controls and transfer booking action.

Validation includes helper tests for search/cabin/confirmation/filter contracts and the existing authenticated booking, payment, check-in and ownership API suites. Browser interactions and PDF rendering were not manually exercised. Responsive changes need visual checks on target devices. Public availability refresh is not a guarantee of a seat until the atomic server lock succeeds.

Verified results: 21 unit tests and 42 isolated MariaDB integration tests passed. Lint: zero errors, four pre-existing warnings. Production build passed. HTTP smoke checks returned 200 for all seven page routes, 401 for anonymous booking-history/check-in requests and 400 for malformed flight IDs; server fare and seat availability response shapes were checked. The temporary production server was stopped afterwards. These HTTP checks are not browser interaction tests.
