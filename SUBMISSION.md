# Submission and demo walkthrough

Live application: https://manifest-710971216169.asia-south1.run.app

Repository: https://github.com/vishal814/manifest

## Five-minute walkthrough

1. Sign in as a provisioned executive. Create a shipment with a fictional supplier and a unique reference.
2. Upload the three original sample documents from `samples/`, selecting invoice, packing list and bill of lading. Each uploaded type is removed from the dropdown.
3. Run real extraction and show evidence and highlighted missing/uncertain fields. Open the original next to the editable fields. Save a review for all three documents, keeping values faithful to the PDFs.
4. Show the 45 kg gross-weight discrepancy, package-count agreement and invoice arithmetic check. A missing package count/line total must keep approval unavailable. Fix transcription errors from the original and save; do not invent data.
5. Sign in as the manager. Enter a note acknowledging the deliberately inconsistent fictional documents and what would require supplier/carrier confirmation before a real filing. Approve the demo revision. Show Approved in the register and download approved CSV.
6. Save a changed reviewed value. Show that approval/export is invalidated until the new revision is approved. Show a manager return note and correction history.
7. Open Accuracy report as manager. Explain agreement versus actual labelled accuracy. Show `evaluation/REPORT.md` for the independently labelled five-document smoke evaluation.
8. Optional failure demo: upload a fictional document in a new shipment and use Enter fields manually. Choose the number of line items; transcribe fields from the original and save. No AI confidence or accuracy credit is fabricated for this path.

## Test evidence

`npm run check` runs types, tests and production build. Tests cover database RLS, invalid inputs, cross-origin requests, review revisions, approval reset/export gating, exact monetary arithmetic, incomplete/mismatched packages/weights, manual-entry validation, report calculations and streamed upload limits.

The real AI evaluation uses five fictional documents: 70/70 expected present values matched and 15/15 expected absent values were left empty in the recorded run. Labels and SHA-256 hashes are in `evaluation/`. This small result is not a substitute for the client's 200-shipment acceptance test or evidence of production reliability.

## Scope and tradeoffs to explain

- Next.js combines screens and authenticated backend routes. Supabase supplies Auth, PostgreSQL and private Storage. AI supplies unverified extraction; deterministic code and managers control approval/export.
- The server reads a shipment snapshot and hashes document/review revisions plus the rules version. A stale decision cannot authorize a new export.
- Discrepancies require human review and a manager note. Missing required inputs cannot be waived by a note. Net weight absent from most documents is explicitly not applicable.
- Source values stay separate from review values; correction history identifies who changed what and when.
- Extraction remains request-based; durable workers/retries were explicitly deferred. Keyboard/screen-reader verification is also deferred.
- Exports use a generic CSV because the actual customs-filing software import template was not supplied.
- No HSN classification, duty calculation, customs filing or real client data is included.

## Before real client use

Validate the exact filing template and retention policy, scan uploads for malware, use distributed rate/billing limits, add durable jobs and monitoring, complete accessibility checks, and evaluate representative skewed/bilingual documents with independently verified labels. The business outcomes (15-minute entry, halved amendments, 95% accuracy on 200 shipments) have not been measured by this demo.
