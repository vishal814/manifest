import { createHash } from "node:crypto";
import { compareGrossWeights, grossWeightKg } from "./cross-checks";
import { readReview } from "./review";
import type { Document, ExtractionRun, Shipment } from "./types";

export type ShipmentDecision = {
  id: string;
  revision: string;
  decision: "approved" | "returned";
  note: string;
  created_at: string;
};

export function latestShipmentDecision(decisions: ShipmentDecision[]) {
  return [...decisions].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
}

export function shipmentReviewState(shipment: Shipment, documents: Document[], latestRuns: Map<string, ExtractionRun>) {
  const records = [...documents].sort((a, b) => a.kind.localeCompare(b.kind)).map(document => {
    const run = latestRuns.get(document.id);
    const review = run?.status === "completed" ? readReview(run.result) : null;
    return { document, run, review, weight: grossWeightKg(review?.fields.grossWeightKg) };
  });
  const revision = createHash("sha256").update(JSON.stringify([
    shipment.id, shipment.reference, shipment.supplier,
    records.map(({ document, run, review }) => [
      document.kind, document.id, document.storage_path, document.filename, run?.id, run?.status, review?.revision,
    ]),
  ])).digest("hex");
  const complete = records.length === 3 && records.every(record => record.review && record.weight !== null);
  const mismatch = compareGrossWeights(records.map(record => record.weight)).status === "mismatch";
  return { revision, records, complete, mismatch };
}

export function canExportShipment(state: ReturnType<typeof shipmentReviewState>, decision?: ShipmentDecision) {
  return state.complete && decision?.decision === "approved" && decision.revision === state.revision
    && (!state.mismatch || Boolean(decision.note.trim()));
}

// Use the same revision-bound approval for the register and shipment workspace.
export function shipmentDisplayStatus(shipment: Shipment, state: ReturnType<typeof shipmentReviewState>, decision?: ShipmentDecision): Shipment["status"] | "approved" {
  if (canExportShipment(state, decision)) return "approved";
  if (state.records.some(record => record.run?.status === "processing")) return "processing";
  if (decision) return "needs_review";
  return shipment.status;
}

function csvCell(value: string | null) {
  const text = value ?? "";
  // Protect spreadsheet users from formulas embedded in source or review text.
  const safe = /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function approvedShipmentCsv(shipment: Shipment, state: ReturnType<typeof shipmentReviewState>, decision: ShipmentDecision) {
  const rows: (string | null)[][] = [
    ["Shipment", "Supplier", "Revision", "Approved at", "Manager note", "Document", "Filename", "Line item", "Field", "Value"],
  ];
  for (const { document, review } of state.records) {
    if (!review) continue;
    const prefix = [shipment.reference, shipment.supplier, state.revision, decision.created_at, decision.note, document.kind, document.filename];
    for (const [field, value] of Object.entries(review.fields)) rows.push([...prefix, "", field, value]);
    review.items.forEach((item, index) => {
      for (const [field, value] of Object.entries(item)) rows.push([...prefix, String(index + 1), field, value]);
    });
  }
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
