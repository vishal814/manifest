import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, errorResponse, sameOrigin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUsage } from "@/lib/request-limits";
import { uuidSchema } from "@/lib/validation";
import { blankExtraction } from "@/lib/manual-entry";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return errorResponse("Invalid request origin.", 403);
  const session = await apiUser();
  if (!session) return errorResponse("Please sign in.", 401);
  const { id } = await context.params;
  const input = z.object({ lineCount: z.number().int().min(1).max(200) }).safeParse(await request.json().catch(() => null));
  if (!uuidSchema.safeParse(id).success || !input.success) return errorResponse("Choose between 1 and 200 line items.");
  const { data: doc } = await session.client.from("documents").select("id").eq("id", id).maybeSingle();
  if (!doc) return errorResponse("Document not found.", 404);
  const { data: latest, error } = await session.client.from("extraction_runs").select("status").eq("document_id", id).neq("status", "failed").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return errorResponse("Unable to check existing work.", 500);
  if (latest) return errorResponse("Open the existing review, or wait for extraction to finish.", 409);
  const usageError = await checkUsage(session.client, session.user.id, "extraction");
  if (usageError) return errorResponse(usageError, 429);
  const admin = createAdminClient();
  const { data: run, error: insertError } = await admin.from("extraction_runs").insert({ document_id: id, model: "manual-entry", status: "processing", requested_by: session.user.id }).select("id").single();
  if (insertError) return errorResponse("Unable to start manual entry. Refresh and try again.", 409);
  const { error: saveError } = await admin.from("extraction_runs").update({ status: "completed", result: blankExtraction(input.data.lineCount) }).eq("id", run.id);
  if (saveError) {
    await admin.from("extraction_runs").update({ status: "failed", error_message: "Manual entry could not be initialized. Please retry." }).eq("id", run.id);
    return errorResponse("Unable to initialize manual entry.", 500);
  }
  return NextResponse.json({ id: run.id }, { status: 201 });
}
