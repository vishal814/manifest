import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, errorResponse, sameOrigin } from "@/lib/api";
import { loadShipmentApproval } from "@/lib/shipment-approval-data";
import { uuidSchema } from "@/lib/validation";

const decisionRequest = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["approved", "returned"]),
  note: z.string().trim().max(1000),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return errorResponse("Invalid request origin.", 403);
  const session = await apiUser();
  if (!session) return errorResponse("Please sign in.", 401);
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return errorResponse("Invalid shipment.");
  const input = decisionRequest.safeParse(await request.json().catch(() => null));
  if (!input.success) return errorResponse("Enter a valid decision and note.");

  const { data: profile, error: profileError } = await session.client.from("profiles")
    .select("role").eq("id", session.user.id).maybeSingle();
  if (profileError) return errorResponse("Unable to verify your role.", 500);
  if (profile?.role !== "manager") return errorResponse("Only managers can make shipment decisions.", 403);

  const { error, snapshot } = await loadShipmentApproval(session.client, id);
  if (error) return errorResponse("Unable to load shipment approval. Check the Day 5 database migration.", 500);
  if (!snapshot) return errorResponse("Shipment not found.", 404);
  const { state } = snapshot;
  const { revision, decision, note } = input.data;
  if (revision !== state.revision) return errorResponse("The shipment changed. Refresh before making a decision.", 409);
  if (decision === "approved" && !state.complete) {
    return errorResponse("Save reviews with valid gross weights for all three documents before approving.", 409);
  }
  if (!note && (decision === "returned" || state.mismatch)) {
    return errorResponse(decision === "returned" ? "Explain what needs correction." : "Document how the gross-weight mismatch was resolved.", 400);
  }

  const { error: saveError } = await session.client.from("shipment_decisions").insert({
    shipment_id: id, revision, decision, note, decided_by: session.user.id,
  });
  if (saveError) return errorResponse("Unable to save the shipment decision.", 500);
  return NextResponse.json({ saved: true });
}
