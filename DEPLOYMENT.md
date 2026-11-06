# Cloud Run deployment

Live evaluation app: https://manifest-710971216169.asia-south1.run.app

Manifest runs as a Next.js standalone Node container on Google Cloud Run in `asia-south1` (Mumbai), in project `advance-engine-513602-a7`.

## Runtime configuration

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `VERTEX_MODEL`, and `APP_ORIGIN` on the Cloud Run service. `APP_ORIGIN` must match its exact public HTTPS origin. The Supabase server key is supplied as `SUPABASE_SECRET_KEY` from Secret Manager (`manifest-supabase-secret`); never put it in a build argument, Dockerfile, repository, or public variable.

The dedicated runtime account `manifest-runtime` has Vertex AI access and access to that individual secret. Google authentication uses its attached identity, without deploying local Google credentials. The dedicated `manifest-build` account has the Cloud Run Builder role.

The Docker build installs locked dependencies and builds inside Linux. Local `.env` files, credentials, `.git`, dependencies, and build output are excluded from both the source upload and Docker context. Supply application configuration at runtime, not during image creation.

## Limits and demo scope

Minimum instances: 0; maximum instances: 1; memory: 512 MiB; CPU: 1; request timeout: 120 seconds. Idle services can have a cold start. These settings limit resources but are not a spending cap; builds, storage and requests can consume trial credits.

The existing global Vertex AI demo restriction allows only the exact fictional sample PDFs. This deployment is for evaluation with synthetic documents. Global AI processing is not an India-only production deployment. Extraction still runs within a request; durable background processing remains deferred.

## Verification

Check `/login` renders, `/shipments` redirects unauthenticated users to login, and protected API routes reject unauthenticated access. With existing test accounts, verify upload, extraction, saved reviews, manager approval and approved CSV download. An edit must invalidate approval. Keyboard and screen-reader checks are explicitly deferred at the user's request.

## Updating

Rebuild and deploy from the repository root with `gcloud run deploy manifest --source . --project advance-engine-513602-a7 --region asia-south1 --build-service-account projects/advance-engine-513602-a7/serviceAccounts/manifest-build@advance-engine-513602-a7.iam.gserviceaccount.com`. Existing service runtime configuration is retained when not overridden. Authenticate your deployment account first; never commit its credentials.

After verifying a replacement secret version, update the Cloud Run secret reference and deploy a new revision. Keep previous working revisions for rollback through Cloud Run.

## Deployment smoke checks (2026-11-06)

Public login, CSS and JavaScript: HTTP 200. Unauthenticated shipment page: HTTP 307 to `/login`. Unauthenticated CSV export and shipment creation: HTTP 401. Cross-origin shipment creation: HTTP 403. Signed-in workflows were tested locally before deployment; repeat them with the existing test accounts on the public URL.
