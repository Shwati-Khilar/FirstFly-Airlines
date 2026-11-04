# Booking PDF export

The confirmation page passes its account-verified booking to `lib/booking-pdf.js`. The online ticket markup and styles are unchanged.

The former html2canvas export captured a live animated element, overrode fonts and stretched its bitmap into a fixed page ratio. This could capture partial animation opacity and distort spacing, text and QR modules. The replacement draws text, shapes and QR modules directly with jsPDF, embeds local licensed fonts, and uses a 250 × 160 mm landscape page with 6 mm margins. It does not capture a screenshot.

Both QR codes encode `PNR:<pnr>|Name:<name>|Flight:<flight_id>|Seat:<seat>` as UTF-8 with error correction and a four-module white quiet zone. These are booking identifiers, not signed airline boarding credentials. Treat exported passenger details as private. Schedules follow the application's IST convention; missing dates are explicitly identified.

Generate three synthetic test-fixture samples (no database writes):

```sh
node scripts/verify-booking-pdf.mjs
```

Files are written to ignored `output/pdf/`. Samples cover long and accented names, different flight IDs, PNRs, seats, classes and an overnight flight. The script checks one-page generation. Visual inspection and QR decoding are separate checks; physical printer/scanner behavior has not been tested. Cormorant Garamond and DM Sans support Latin names; broader writing-system coverage requires additional fonts.


Optional rendered-PDF verification: install Python packages `pypdf`, `Pillow`, and `zxing-cpp` in a separate verification environment, install Poppler (`pdftoppm` on PATH or set `PDFTOPPM` to its executable), then run `python scripts/verify-pdf-render.py` after generating the samples. It checks both QR payloads at 150/300 DPI, embedded fonts and extractable text. These are verification tools, not application dependencies.
