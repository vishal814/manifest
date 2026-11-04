import { apiUser, errorResponse } from "@/lib/api";
import { approvedShipmentCsv, canExportShipment } from "@/lib/shipment-approval";
import { loadShipmentApproval } from "@/lib/shipment-approval-data";
import { uuidSchema } from "@/lib/validation";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await apiUser();
  if (!session) return errorResponse("Please sign in.", 401);
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return errorResponse("Invalid shipment.");
  const { error, snapshot } = await loadShipmentApproval(session.client, id);
  if (error) return errorResponse("Unable to load shipment approval. Check the Day 5 database migration.", 500);
  if (!snapshot) return errorResponse("Shipment not found.", 404);
  const { shipment, state, decision } = snapshot;
  if (!decision || !canExportShipment(state, decision)) {
    return errorResponse("Export requires manager approval for the current shipment version.", 409);
  }
  return new Response(approvedShipmentCsv(shipment, state, decision), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="manifest-${shipment.reference}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
