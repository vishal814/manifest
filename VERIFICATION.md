# Verification record - 2026-11-06

## Automated

- `npm run check`: TypeScript passed; 89 tests passed in nine files; production build passed.
- Following the final invoice-message change, all 89 tests and TypeScript passed again; Cloud Build produced the deployed container successfully.
- Tests cover PostgreSQL migrations and RLS, signed request origin validation, reviewed revisions, export/approval gates, edited approvals, missing packages and invoice totals, exact decimal addition, optional net weights, upload byte limits, manual-entry form validation, reviewer-agreement calculations and evaluation quotas.

## Real AI smoke evaluation

`npm run evaluate:ai` called the actual extraction adapter using `gemini-3.5-flash-lite` in `asia-south1`. Five fictional documents succeeded. All 70 expected present values matched; all 15 expected absent values were empty. Fixtures include text PDFs, a rasterized PNG invoice and a two-line invoice. Labels, hashes and observed values are in `evaluation/`.

This is a small synthetic smoke evaluation, not the requested business acceptance benchmark on 200 historical shipments. AI confidence and human-review agreement are not independent accuracy measurements.

## Live browser checks

- Signed manager created fictional shipment `QA-FINAL-1106` and uploaded the two-line fictional invoice.
- Manual entry initialized two empty line-item rows with no fabricated AI values/confidence.
- Values were transcribed from the fixture and saved. Reload retained the saved review; invoice arithmetic passed.
- Approval remained disabled while the packing list and bill of lading were absent.
- Manager quality report loaded by field and supplier. It showed six reviewed AI documents and excluded the new manual-only document.
- The QA shipment is retained and clearly named for testing; existing user shipments/reviews were not edited.

## Public endpoint checks

- Login: HTTP 200.
- Unauthenticated quality report: HTTP 307 to `/login`.
- Unauthenticated same-origin manual entry: HTTP 401.
- Cross-origin manual entry: HTTP 403.

The final serving revision is `manifest-00005-w65`, deployed to Cloud Run Mumbai. No new SQL migration was needed. Older approvals require a new decision because the approval-rules version now includes package/invoice checks.

## Deferred and unmeasured

Durable background extraction/retries and keyboard/screen-reader checks remain deferred by explicit user choice. Distributed quotas, malware scanning, real filing-template compatibility and production operational controls remain outside this evaluation release. The 15-minute entry-time and amendment-reduction business targets have not been measured.
