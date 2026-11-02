import { NextResponse } from "next/server";
import { apiUser, errorResponse } from "@/lib/api";
import { uuidSchema } from "@/lib/validation";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await apiUser();
  if (!session) return errorResponse("Please sign in.", 401);
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return errorResponse("Invalid document.");
  const { data: doc } = await session.client.from("documents").select("storage_path").eq("id", id).single();
  if (!doc) return errorResponse("Document not found.", 404);
  const { data, error } = await session.client.storage.from("shipment-documents").createSignedUrl(doc.storage_path, 120);
  if (error) return errorResponse("Unable to open this document.", 500);
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
