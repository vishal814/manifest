# Manifest

[Open the live evaluation app](https://manifest-710971216169.asia-south1.run.app)

Manifest helps a customs documentation team extract data from invoices, packing lists and bills of lading, review source-backed values, resolve mismatches and export a manager-approved shipment. All supplied fixtures contain fictional data.

## Implemented

- Next.js frontend/backend, Supabase email/password sign-in, PostgreSQL and private document storage.
- Executives see their own shipments; managers see all shipments and quality reports. Database row-level policies enforce access.
- Shipment register with search and version-aware Draft, Processing, Needs review and Approved filters.
- One PDF/JPG/PNG per document type, 10 MB per upload, ten PDF pages. Uploads validate file signatures and enforce actual streamed body size.
- Real Vertex AI extraction in Mumbai, validated fields, evidence and confidence; highlighted uncertainty and a manual-entry fallback for failed/unreadable sources.
- Side-by-side review, editable document/line-item values and persistent correction history that retains the original extraction.
- Deterministic gross-weight, available net-weight and package-count comparisons, plus exact decimal invoice-total versus line-total addition.
- All three reviews and complete check inputs are required for approval. A manager resolution note is required for discrepancies. Approval and CSV export apply only to the reviewed revision. Later edits require approval again.
- Manager quality report by field and supplier. This measures original AI agreement with human review, separately from independently labelled evaluation.
- Evaluation usage limits, protected writes, input validation and private short-lived preview links.

## Run locally

Requires Node.js 24 and npm. Repository: `D:\Manifest`.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local`. Fill Supabase URL, publishable key and server-only secret key. Never use a `NEXT_PUBLIC_` variable for a secret.
3. On a fresh Supabase project, run the contents of `supabase/migrations/202611020001_day_one.sql`, then `supabase/migrations/202611050001_shipment_approvals.sql` in SQL Editor. Do not paste their file paths. No new migration is needed for the final checks/reporting release.
4. Provision fictional users in Supabase Authentication. Their profiles default to executive. Promote the intended manager by Auth UUID:

```sql
update public.profiles
set role = 'manager', display_name = 'Sample Manager'
where id = 'REPLACE-WITH-AUTH-USER-UUID';
```

5. Configure `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=asia-south1`, `VERTEX_MODEL=gemini-3.5-flash-lite`. Authenticate locally with `gcloud auth application-default login`. Cloud Run uses its attached service identity.
6. Run `npm run dev`. Restart after environment changes.

Accounts are provisioned by the workspace owner; the public app has no self-sign-up flow. Sign in with an existing test account. No passwords or keys are included in this repository.

## Checks and evaluation

```text
npm run check
npm run evaluate:ai
```

The first command runs TypeScript, automated tests and a production build without AI calls. Tests include PostgreSQL migrations/RLS, review revisions, approval gates, decimal arithmetic, usage limits and bounded upload streams. The second makes real AI calls using configured credentials and consumes provider quota/credits.

[evaluation/REPORT.md](evaluation/REPORT.md) contains the recorded five-document synthetic evaluation: three shipment PDFs, a rasterized invoice and a two-line invoice. Labels, fixture hashes and observed values are retained for reproducibility. This is a smoke evaluation, not evidence that the client's target of 95% on 200 historical shipments has been achieved. AI confidence is not an accuracy measurement. The in-app report measures reviewer agreement, which can miss uncorrected errors.

Original sample PDFs are in `samples/`; labelled extra cases are in `samples/evaluation/`. `node scripts/generate-samples.mjs` regenerates the original fictional PDFs. The original invoice/BOL state 3,120 kg while the packing list states 3,165 kg, deliberately triggering a 45 kg discrepancy. Preserve source values; do not change weights just to make a check pass.

## Architecture

The browser displays screens and sends authenticated requests to Next.js. Supabase Auth identifies the user; RLS restricts reads to permitted shipments. Private Storage holds source files. The backend checks document access before using its server-only key to save validated extraction results and reviews. AI reads one document at a time; deterministic server code handles cross-checks and approval/export decisions. The same revision-bound status drives the register and shipment page.

Approval hashes include an approval-rules version. Existing approvals made before the final package/invoice checks require a fresh decision. No document data is rewritten by this change.

## Security and hosting

- Cloud Run and Vertex AI use Mumbai (`asia-south1`). Supabase Mumbai (`ap-south-1`) was confirmed by the workspace owner on 2026-11-06. See [DEPLOYMENT.md](DEPLOYMENT.md).
- The Supabase server key is in Secret Manager, outside Git and the image. Google credentials come from the runtime service account.
- Evaluation allowance per user: 50 extraction/manual attempts and 100 uploaded documents in a rolling 24 hours. In-process burst limits: 10 extraction/manual requests and 20 uploads per minute. Daily usage is checked from stored records. These are evaluation controls, not an atomic distributed billing cap; concurrent requests may race and process restarts reset burst counters.
- Actual multipart bodies are limited to 10 MB plus 64 KB overhead, even without a Content-Length header. Source file content/type and PDF page counts are checked.
- Original preview links expire after two minutes. Mutating APIs check origin, session and access. Managers alone can approve shipments or view aggregate quality reports.
- PDF validation is not malware scanning. Do not use real personal/commercial data for the evaluation. Production needs malware scanning, distributed quotas, operational monitoring, data-retention rules and a representative labelled dataset.

## Deliberately deferred / limits

- Durable background extraction and automatic retries remain deferred by the user. Extraction runs within a bounded request; failed attempts can be retried and previous successful reviews are retained.
- Keyboard and screen-reader checks are deferred by the user.
- CSV is a generic reviewed-data export, not a verified filing-software Excel template. Customs portal filing, HSN classification and duty calculation are out of scope.
- Invoice checks compare stated line totals with the stated invoice total. Separate tax/freight/discount adjustments, negative credit lines and mixed currencies need explicit handling for production; a manager must explain differences. Money parsing supports up to six decimal places, without floating-point addition.
- Net weights are compared only where stated; fewer than two is explicitly not applicable. Missing or invalid gross weight/package count, or incomplete invoice totals, blocks approval.
- Initial manual-entry row count is chosen before starting (1-200). Existing extracted rows can be edited; adding/removing rows after extraction is not supported.

## Submission

Use [SUBMISSION.md](SUBMISSION.md) for the walkthrough, test evidence and scope notes. Commit history is preserved on the public repository. No secrets or real personal data belong in Git.
