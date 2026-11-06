import { describe, expect, it } from "vitest";
import { approvedShipmentCsv, canExportShipment, shipmentDisplayStatus, shipmentReviewState } from "../src/lib/shipment-approval";
import type { Document, ExtractionRun, Shipment } from "../src/lib/types";
import { extractionSchema } from "../src/lib/validation";

const shipment: Shipment = { id: "shipment", reference: "SHP-DEMO", supplier: 'Supplier "A"', created_by: "owner", status: "needs_review", created_at: "" };
const kinds = ["invoice", "packing_list", "bill_of_lading"] as const;
const documents: Document[] = kinds.map(kind => ({
  id: kind, shipment_id: shipment.id, kind, filename: kind + ".pdf", storage_path: kind,
  mime_type: "application/pdf", size_bytes: 100, created_at: "",
}));
const reviewId = "1b82a2c8-7b4d-49c9-a318-b8a4a8bdb390";

function runs(weights = ["3120", "3165", "3120"]) {
  return new Map<string, ExtractionRun>(documents.map(({ id }, index) => [id, {
    id, document_id: id, status: "completed", error_message: null, created_at: "",
    result: { review: {
      fields: {
        ...Object.fromEntries(Object.keys(extractionSchema.shape.fields.shape).map(key => [key, null])),
        grossWeightKg: weights[index],
        packageCount: "120", currency: "USD", invoiceTotal: "10",
        buyer: '=HYPERLINK("example")',
      },
      items: [{ description: "Widgets", hsn: null, quantity: "2", unitPrice: "5", lineTotal: "10" }],
      revision: reviewId, savedBy: reviewId, savedAt: "2026-11-05T00:00:00.000Z",
    } },
  }]));
}

describe("approval-gated shipment export", () => {
  it("requires a recorded resolution for a mismatch and escapes spreadsheet formulas", () => {
    const state = shipmentReviewState(shipment, documents, runs());
    const decision = { id: "decision", revision: state.revision, decision: "approved" as const, note: "", created_at: "2026-11-05" };
    expect(canExportShipment(state, decision)).toBe(false);
    const resolved = { ...decision, note: "Carrier confirmed the discrepancy." };
    expect(canExportShipment(state, resolved)).toBe(true);
    const csv = approvedShipmentCsv(shipment, state, resolved);
    expect(csv).toContain('"Supplier ""A"""');
    expect(csv).toContain('"buyer","\'=HYPERLINK(""example"")"');
    expect(csv).toContain('"invoice.pdf","1","quantity","2"');
  });

  it("blocks export after a review revision changes, or a manager returns the shipment", () => {
    const currentRuns = runs(["3120", "3120", "3120"]);
    const state = shipmentReviewState(shipment, documents, currentRuns);
    const decision = { id: "decision", revision: state.revision, decision: "approved" as const, note: "", created_at: "2026-11-05" };
    expect(canExportShipment(state, decision)).toBe(true);
    expect(canExportShipment(state, { ...decision, decision: "returned" })).toBe(false);
    const invoice = currentRuns.get("invoice")!;
    const result = invoice.result as { review: { revision: string } };
    result.review.revision = "2b82a2c8-7b4d-49c9-a318-b8a4a8bdb390";
    expect(canExportShipment(shipmentReviewState(shipment, documents, currentRuns), decision)).toBe(false);
    expect(canExportShipment(shipmentReviewState(shipment, documents.slice(1), currentRuns), decision)).toBe(false);
  });
});


describe("shipment dashboard status", () => {
  it("removes a current approval from the review queue even when extraction status still says needs_review", () => {
    const state = shipmentReviewState(shipment, documents, runs(["3120", "3120", "3120"]));
    const decision = { id: "decision", revision: state.revision, decision: "approved" as const, note: "", created_at: "2026-11-05" };
    expect(shipmentDisplayStatus(shipment, state, decision)).toBe("approved");
    expect(shipmentDisplayStatus(shipment, state)).toBe("needs_review");
  });

  it("returns an edited approval to needs_review and respects a later return decision", () => {
    const currentRuns = runs(["3120", "3120", "3120"]);
    const state = shipmentReviewState(shipment, documents, currentRuns);
    const decision = { id: "decision", revision: state.revision, decision: "approved" as const, note: "", created_at: "2026-11-05" };
    const result = currentRuns.get("invoice")!.result as { review: { revision: string } };
    result.review.revision = "2b82a2c8-7b4d-49c9-a318-b8a4a8bdb390";
    expect(shipmentDisplayStatus(shipment, shipmentReviewState(shipment, documents, currentRuns), decision)).toBe("needs_review");
    expect(shipmentDisplayStatus(shipment, state, { ...decision, decision: "returned" })).toBe("needs_review");
  });

  it("requires complete reviews and mismatch resolution before displaying approved", () => {
    const state = shipmentReviewState(shipment, documents, runs());
    const decision = { id: "decision", revision: state.revision, decision: "approved" as const, note: "", created_at: "2026-11-05" };
    expect(shipmentDisplayStatus(shipment, state, decision)).toBe("needs_review");
    expect(shipmentDisplayStatus(shipment, state, { ...decision, note: "Carrier verified discrepancy." })).toBe("approved");
    const incomplete = shipmentReviewState(shipment, documents.slice(1), runs());
    expect(shipmentDisplayStatus(shipment, incomplete, { ...decision, revision: incomplete.revision })).toBe("needs_review");
  });

  it("shows processing while an approved document is being extracted again, and preserves drafts", () => {
    const currentRuns = runs();
    const state = shipmentReviewState(shipment, documents, currentRuns);
    const decision = { id: "decision", revision: state.revision, decision: "approved" as const, note: "Resolved.", created_at: "2026-11-05" };
    currentRuns.set("invoice", { ...currentRuns.get("invoice")!, id: "new-run", status: "processing", result: null });
    expect(shipmentDisplayStatus(shipment, shipmentReviewState(shipment, documents, currentRuns), decision)).toBe("processing");
    const draft = { ...shipment, status: "draft" as const };
    expect(shipmentDisplayStatus(draft, shipmentReviewState(draft, [], new Map()))).toBe("draft");
  });
});


it("blocks approval/export when a saved package count or invoice line total is missing", () => {
  const currentRuns = runs(["3120", "3120", "3120"]);
  const before = shipmentReviewState(shipment, documents, currentRuns);
  const decision = { id: "decision", revision: before.revision, decision: "approved" as const, note: "Reviewed.", created_at: "2026-11-06" };
  const packing = currentRuns.get("packing_list")!.result as { review: { fields: Record<string, string | null> } };
  packing.review.fields.packageCount = null;
  const after = shipmentReviewState(shipment, documents, currentRuns);
  expect(after.complete).toBe(false); expect(canExportShipment(after, decision)).toBe(false);
  packing.review.fields.packageCount = "120";
  const invoice = currentRuns.get("invoice")!.result as { review: { items: Record<string, string | null>[] } };
  invoice.review.items[0].lineTotal = null;
  expect(shipmentReviewState(shipment, documents, currentRuns).complete).toBe(false);
});
