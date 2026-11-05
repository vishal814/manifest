import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { latestShipmentDecision, shipmentReviewState, type ShipmentDecision } from "./shipment-approval";
import type { Document, ExtractionRun, Shipment } from "./types";

type Snapshot = Shipment & {
  documents: (Document & { extraction_runs: ExtractionRun[] })[];
  shipment_decisions: ShipmentDecision[];
};

export async function loadShipmentApproval(client: SupabaseClient, id: string) {
  // Read the data and decisions from a single database snapshot.
  const { data, error } = await client.from("shipments")
    .select("*,documents(*,extraction_runs(id,document_id,status,result,error_message,created_at)),shipment_decisions(id,revision,decision,note,created_at)")
    .eq("id", id)
    .neq("documents.extraction_runs.status", "failed")
    .order("created_at", { referencedTable: "documents.extraction_runs", ascending: false })
    .limit(1, { referencedTable: "documents.extraction_runs" })
    .order("created_at", { referencedTable: "shipment_decisions", ascending: false })
    .order("id", { referencedTable: "shipment_decisions", ascending: false })
    .limit(1, { referencedTable: "shipment_decisions" })
    .maybeSingle();
  if (error || !data) return { error, snapshot: null };

  const shipment = data as Snapshot;
  const runs = new Map<string, ExtractionRun>();
  for (const document of shipment.documents) {
    const latest = document.extraction_runs[0];
    if (latest) runs.set(document.id, latest);
  }
  return { error: null, snapshot: {
    shipment,
    state: shipmentReviewState(shipment, shipment.documents, runs),
    decision: latestShipmentDecision(shipment.shipment_decisions),
  } };
}
