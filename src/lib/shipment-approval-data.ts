import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { latestShipmentDecision, shipmentReviewState, type ShipmentDecision } from "./shipment-approval";
import type { Document, ExtractionRun, Shipment } from "./types";

type Snapshot = Shipment & {
  documents: (Document & { extraction_runs: ExtractionRun[] })[];
  shipment_decisions: ShipmentDecision[];
};

function approvalQuery(client: SupabaseClient) {
  // Read the data and decisions from a single database snapshot.
  return client.from("shipments")
    .select("*,documents(*,extraction_runs(id,document_id,status,result,error_message,created_at)),shipment_decisions(id,revision,decision,note,created_at)")
    .neq("documents.extraction_runs.status", "failed")
    .order("created_at", { referencedTable: "documents.extraction_runs", ascending: false })
    .limit(1, { referencedTable: "documents.extraction_runs" })
    .order("created_at", { referencedTable: "shipment_decisions", ascending: false })
    .order("id", { referencedTable: "shipment_decisions", ascending: false })
    .limit(1, { referencedTable: "shipment_decisions" });
}

function approvalSnapshot(shipment: Snapshot) {
  const runs = new Map<string, ExtractionRun>();
  for (const document of shipment.documents) {
    const latest = document.extraction_runs[0];
    if (latest) runs.set(document.id, latest);
  }
  return {
    shipment,
    state: shipmentReviewState(shipment, shipment.documents, runs),
    decision: latestShipmentDecision(shipment.shipment_decisions),
  };
}

export async function loadShipmentApproval(client: SupabaseClient, id: string) {
  const { data, error } = await approvalQuery(client).eq("id", id).maybeSingle();
  return { error, snapshot: data ? approvalSnapshot(data as Snapshot) : null };
}

export async function loadShipmentRegister(client: SupabaseClient) {
  // One RLS-protected snapshot for all rows; avoid a request per shipment.
  const { data, error } = await approvalQuery(client).order("created_at", { ascending: false }).limit(200);
  return { error, snapshots: (data ?? []).map(row => approvalSnapshot(row as Snapshot)) };
}
