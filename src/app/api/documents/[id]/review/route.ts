import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUser, errorResponse, sameOrigin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { readReview, reviewRequest } from "@/lib/review";
import { extractionSchema, uuidSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return errorResponse("Invalid request origin.", 403);
  const session = await apiUser();
  if (!session) return errorResponse("Please sign in.", 401);

  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return errorResponse("Invalid document.");
  const input = reviewRequest.safeParse(await request.json().catch(() => null));
  if (!input.success) return errorResponse("Check the review values and try again.");

  // Read through the signed-in user's policies before writing with the server client.
  const { data: run, error } = await session.client.from("extraction_runs")
    .select("id,status,result").eq("document_id", id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return errorResponse("Unable to load the extraction.", 500);
  if (!run) return errorResponse("Extraction not found.", 404);

  const { runId, revision, fields, items } = input.data;
  const current = readReview(run.result);
  if (run.id !== runId || run.status !== "completed" || revision !== (current?.revision ?? null)) {
    return errorResponse("This extraction or review changed. Reload the page before saving.", 409);
  }
  const extraction = extractionSchema.safeParse(run.result);
  if (!extraction.success || items.length !== extraction.data.items.length) {
    return errorResponse("Review values must match the original extraction fields and rows.");
  }

  const review = { fields, items, revision: randomUUID(), savedAt: new Date().toISOString(), savedBy: session.user.id };
  const update = createAdminClient().from("extraction_runs")
    .update({ result: { ...run.result, review } })
    .eq("id", runId).eq("document_id", id).eq("status", "completed");
  const guarded = revision
    ? update.eq("result->review->>revision", revision)
    : update.is("result->review", null);
  const { data: saved, error: saveError } = await guarded.select("id").maybeSingle();
  if (saveError) return errorResponse("Unable to save the review.", 500);
  if (!saved) return errorResponse("Another review was saved. Reload the page and try again.", 409);
  return NextResponse.json({ revision: review.revision, savedAt: review.savedAt });
}

