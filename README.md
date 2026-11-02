# Manifest

A Next.js + Supabase workspace for shipment document extraction and human review.

## Project location

This repository lives at `D:\Manifest`.

## Day 1 status

Implemented: setup screen, email/password sign-in and sign-out, executive/manager profiles, protected shipment list with search/status filters, shipment creation, private PDF/JPG/PNG uploads, short-lived original-document links, real Vertex AI extraction adapter, persistent results and uncertainty indicators, loading/empty/error states, and a database migration with row-level access policies.

Not implemented yet: durable background jobs, manual entry and field editing, cross-document checks, manager approval, audit history, and CSV export. The UI labels the current milestone. No extraction output is a verified customs record.

## Requirements

- Node.js 24 LTS and npm.
- A Supabase project (choose Mumbai), with SQL Editor and Auth access.
- For extraction: a Google Cloud project with billing, the Vertex AI API enabled, a currently available vision-capable model, and Application Default Credentials.
- Before confidential documents are used, verify the selected model's data-use terms and actual processing location. A regional URL alone is not proof of data residency.

## Local setup

1. Open a terminal in `D:\Manifest`.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and fill in your Supabase project URL, publishable key and **server-only** secret key. Never put a secret key in a variable beginning with `NEXT_PUBLIC_`.
4. In Supabase SQL Editor, run `supabase/migrations/202611020001_day_one.sql` once on a fresh project. It creates tables, profiles, the private document bucket and access policies.
5. Create two fictional test users in Supabase Authentication > Users. Profiles are created automatically as executives. Set their display names through Auth user metadata or SQL.
6. Promote the intended manager using SQL, replacing the placeholder with their Auth user UUID:

```sql
update public.profiles
set role = 'manager', display_name = 'Sample Manager'
where id = 'REPLACE-WITH-AUTH-USER-UUID';
```

7. Fill in `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` and `VERTEX_MODEL` for extraction. Authenticate locally using `gcloud auth application-default login`. On Cloud Run, attach a service account with least-privilege Vertex AI access instead of committing a service account key.
8. Run `npm run dev`, then open the Local URL printed by Next.js. Without Supabase configuration the application shows a setup page; it does not fabricate a signed-in session or saved records.

The setup screen checks whether environment variables exist. It cannot verify that the migration or provider credentials are valid. Restart the development server after changing environment variables.

## Sample documents

Run `node scripts/generate-samples.mjs`. The `samples/` folder contains an invoice, packing list, bill of lading and `expected.json` with labelled reference values.

Create `SHP-24811` with supplier `Company B (fictional), China`, then upload the three sample PDFs. The invoice and bill of lading show 3,120 kg; the packing list shows 3,165 kg. This deliberately creates a 45 kg discrepancy for the future cross-check engine. These files contain synthetic information, not real personal or commercial data.

## Tests and build

```text
npm run typecheck
npm test
npm run build
```

Upload/schema tests run without cloud credentials. Database policy tests use an embedded PostgreSQL engine and stub only the Supabase-managed auth/storage schemas. An actual Supabase connection and live AI extraction still require the project credentials above.

## Access and security

- Executives can access their own shipments; managers can access all shipments in this single-company app.
- Users cannot assign or edit their role through the app or authenticated database API.
- Source documents are private. Original-document links expire after two minutes.
- Uploads accept PDF, JPG and PNG up to 10 MB; PDFs are limited to ten pages. File signatures are checked in addition to MIME types. Deploy a request-body limit at the ingress too; application checks alone are not a streaming upload defence.
- Client-side accounts cannot write extraction results or shipment processing status. The backend uses the server-only Supabase key only after checking access to the document.
- Changing POST requests require a matching origin. Supabase authentication rate limits apply to sign-in. Add per-user extraction quotas and upload rate limits before opening access beyond the test team.
- Credentials and SDK error payloads are not printed by the app. Keep `.env.local`, cloud credential files and real personal data outside Git.
- PDFs are parsed for integrity/page count, not scanned for malware. Only use synthetic evaluation files until production upload protections are added.

## Day 1 extraction limitation

Extraction currently runs in a bounded server request. The database records the attempt and prevents concurrent extraction for the same document. Failed calls can be retried; attempts interrupted for more than three minutes can be reclaimed. This is not durable background execution. Day 2 will move extraction to a private worker and queue so it does not depend on the browser request.

## Next milestones

- Day 2: durable extraction worker/queue and retry handling.
- Day 3: side-by-side document review, editable fields and manual entry.
- Day 4: deterministic cross-checks, unit normalization and correction history.
- Day 5: manager approval, revision invalidation and CSV export.
- Day 6: security/integration tests and mobile/accessibility polish.
- Day 7: deployment, labelled extraction evaluation and submission walkthrough.

## Architecture

The Next.js app handles screens and authenticated backend routes. Supabase Auth identifies users; PostgreSQL stores records; private Storage holds originals. The AI adapter reads each document independently and returns validated structured values with source evidence and heuristic confidence scores. AI confidence is not a measured probability of correctness. Cross-check and export decisions will be implemented in deterministic server code.
