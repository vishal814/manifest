import { NextResponse } from "next/server";
import { apiUser, errorResponse, sameOrigin } from "@/lib/api";
import { hasAIConfig } from "@/lib/config";
import { extractDocument } from "@/lib/ai/extract";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return errorResponse("Invalid request origin.", 403);
  const session = await apiUser();
  if (!session) return errorResponse("Please sign in.", 401);
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return errorResponse("Invalid document.");
  const { data: doc } = await session.client.from("documents").select("*").eq("id", id).single();
  if (!doc) return errorResponse("Document not found.", 404);
  if (!hasAIConfig() || !process.env.SUPABASE_SECRET_KEY) return errorResponse("Extraction is not configured. Add the server-side Supabase key and Vertex AI settings, then restart the app.", 503);
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  await admin.from("extraction_runs").update({ status: "failed", error_message: "The previous attempt timed out. Retry extraction." }).eq("document_id", id).eq("status", "processing").lt("created_at", staleBefore);
  const { data: run, error: runError } = await admin.from("extraction_runs").insert({ document_id: id, status: "processing", model: process.env.VERTEX_MODEL, requested_by: session.user.id }).select("id").single();
  if (runError) return errorResponse(runError.code === "23505" ? "Extraction is already running for this document." : "Unable to start extraction.", runError.code === "23505" ? 409 : 500);
  // Status is derived in Postgres from the latest extraction run per document.
  // Day 1 uses a bounded server request; durable background processing is Day 2.
  try {
    const { data: file, error } = await session.client.storage.from("shipment-documents").download(doc.storage_path);
    if (error || !file) throw new Error("Document unavailable.");
    const result = await extractDocument(Buffer.from(await file.arrayBuffer()), doc.mime_type, doc.kind);
    const { error: saveError } = await admin.from("extraction_runs").update({ status: "completed", result, error_message: null }).eq("id", run.id);
    if (saveError) throw new Error("Unable to save extraction.");
    return NextResponse.json({ id: run.id, status: "completed" });
  } catch {
    // Do not expose SDK responses, document contents or credentials in logs/errors.
    const message = "Extraction failed or returned invalid data. Check model access, region and credentials, then retry. Unreadable pages will need manual review.";
    await admin.from("extraction_runs").update({ status: "failed", error_message: message }).eq("id", run.id);
    return errorResponse(message, 502);
  }
}
