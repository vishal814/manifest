import { boundedFormData, BodyTooLarge } from "@/lib/bounded-body";
import { checkUsage } from "@/lib/request-limits";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { NextResponse } from "next/server";
import { apiUser, errorResponse, sameOrigin } from "@/lib/api";
import { detectFileType, documentKindSchema, MAX_FILE_BYTES, uuidSchema, validateFileMetadata } from "@/lib/validation";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return errorResponse("Invalid request origin.", 403);
  const session = await apiUser();
  if (!session) return errorResponse("Please sign in.", 401);
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return errorResponse("Invalid shipment reference.");
  const { data: shipment } = await session.client.from("shipments").select("id").eq("id", id).single();
  if (!shipment) return errorResponse("Shipment not found.", 404);
  const usageError = await checkUsage(session.client, session.user.id, "upload");
  if (usageError) return errorResponse(usageError, 429);
  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > MAX_FILE_BYTES + 65536) return errorResponse("Choose a file smaller than 10 MB.", 413);
  let form: FormData | null;
  try { form = await boundedFormData(request, MAX_FILE_BYTES + 65536); }
  catch (error) { return errorResponse(error instanceof BodyTooLarge ? "Choose a file smaller than 10 MB." : "Invalid upload.", error instanceof BodyTooLarge ? 413 : 400); }
  if (!form) return errorResponse("Invalid upload.");
  const file = form.get("file");
  const kind = documentKindSchema.safeParse(form.get("kind"));
  if (!(file instanceof File) || !kind.success) return errorResponse("Choose a document and its type.");
  const metadataError = validateFileMetadata(file);
  if (metadataError) return errorResponse(metadataError);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectFileType(bytes);
  if (!mimeType || mimeType !== file.type) return errorResponse("The file contents do not match its type.");
  if (mimeType === "application/pdf") {
    try {
      const pdf = await PDFDocument.load(bytes);
      if (pdf.getPageCount() > 10) return errorResponse("Upload at most 10 pages per document.");
    } catch { return errorResponse("This PDF is damaged or password protected. Use an unlocked PDF or an image."); }
  }
  const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : "jpg";
  const path = `shipments/${id}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await session.client.storage.from("shipment-documents").upload(path, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) return errorResponse("Upload failed. Check the private bucket and storage policies.", 500);
  const { data, error } = await session.client.from("documents").insert({ shipment_id: id, kind: kind.data, filename: file.name.slice(0, 200), storage_path: path, mime_type: mimeType, size_bytes: bytes.length, created_by: session.user.id }).select("id").single();
  if (error) {
    await session.client.storage.from("shipment-documents").remove([path]);
    return errorResponse(error.code === "23505" ? "This document type is already uploaded for this shipment." : "The document record could not be saved.", error.code === "23505" ? 409 : 500);
  }
  return NextResponse.json(data, { status: 201 });
}
