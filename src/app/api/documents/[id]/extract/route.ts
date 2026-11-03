import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUser, errorResponse, sameOrigin } from "@/lib/api";
import { hasAIConfig } from "@/lib/config";
import { extractDocument } from "@/lib/ai/extract";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

const demoHashes: Readonly<Record<string, string>> = {
  invoice: "4e227b7ed92145694c3fbb5c513c46858088d6d935409ce55cd0522f8c31650c",
  packing_list: "d0009b17244d71e21f530e7bab344b004af70ed3de682f2a2afb3221e0e08ebe",
  bill_of_lading: "1b452577e035e0bf8b7a8ee1905d2a9a4a2f513ac25fcfd6952146ceb6dc850b",
};

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
  const { data: file, error } = await session.client.storage.from("shipment-documents").download(doc.storage_path);
  if (error || !file) return errorResponse("Unable to read the uploaded document.", 502);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (process.env.GOOGLE_CLOUD_LOCATION === "global") {
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (doc.mime_type !== "application/pdf" || hash !== demoHashes[doc.kind]) {
      return errorResponse("Global demo extraction accepts only the original Manifest sample PDFs, uploaded under their matching document types.", 403);
    }
  }

  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  await admin.from("extraction_runs").update({ status: "failed", error_message: "The previous attempt timed out. Retry extraction." }).eq("document_id", id).eq("status", "processing").lt("created_at", staleBefore);
  const { data: run, error: runError } = await admin.from("extraction_runs").insert({ document_id: id, status: "processing", model: process.env.VERTEX_MODEL, requested_by: session.user.id }).select("id").single();
  if (runError) return errorResponse(runError.code === "23505" ? "Extraction is already running for this document." : "Unable to start extraction.", runError.code === "23505" ? 409 : 500);
  // Status is derived in Postgres from the latest extraction run per document.
  // Extraction runs in a bounded server request.
  try {
    const result = await extractDocument(bytes, doc.mime_type, doc.kind);
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
