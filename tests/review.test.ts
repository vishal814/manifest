import { describe, expect, it } from "vitest";
import { readReview, reviewChanges, reviewRequest } from "../src/lib/review";
import { extractionSchema } from "../src/lib/validation";

describe("document reviews", () => {
  it("restores saved corrections including intentionally blank fields and rows", () => {
    const id = "1b82a2c8-7b4d-49c9-a318-b8a4a8bdb390";
    const draft = reviewRequest.parse({
      runId: id,
      revision: null,
      fields: {
        ...Object.fromEntries(Object.keys(extractionSchema.shape.fields.shape).map(key => [key, ""])),
        grossWeightKg: " 3165 ",
      },
      items: [{ description: "LED panel", hsn: "", quantity: "2400", unitPrice: "", lineTotal: "" }],
    });
    const review = { fields: draft.fields, items: draft.items, revision: id, savedBy: id, savedAt: "2026-11-03T00:00:00.000Z" };
    expect(readReview({ review })).toMatchObject({
      revision: id,
      fields: { grossWeightKg: "3165", netWeightKg: null },
      items: [{ quantity: "2400", hsn: null }],
    });
  });
});

it("records changed fields and line items against the last saved review", () => {
  const id = "1b82a2c8-7b4d-49c9-a318-b8a4a8bdb390";
  const rawFields = Object.fromEntries(Object.keys(extractionSchema.shape.fields.shape).map(key => [key, ""]));
  const previous = reviewRequest.parse({
    runId: id, revision: null,
    fields: { ...rawFields, grossWeightKg: "3128" },
    items: [{ description: "LED panel", hsn: "", quantity: "2400", unitPrice: "", lineTotal: "" }],
  });
  const current = readReview({ review: {
    ...previous, revision: id, savedBy: id, savedAt: "2026-11-03T00:00:00.000Z",
  } });
  const asExtracted = (value: string | null) => ({ value, confidence: 1, sourcePage: 1, evidence: null });
  const extraction = extractionSchema.parse({
    fields: Object.fromEntries(Object.keys(rawFields).map(key => [key, asExtracted(key === "grossWeightKg" ? "3120" : null)])),
    items: previous.items.map(item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, asExtracted(value)]))),
    warnings: [],
  });
  expect(reviewChanges(extraction, current, previous)).toEqual([]);
  expect(reviewChanges(extraction, current, {
    fields: { ...previous.fields, grossWeightKg: "3.12 tonnes" },
    items: [{ ...previous.items[0], quantity: null }],
  })).toEqual([
    { field: "grossWeightKg", before: "3128", after: "3.12 tonnes" },
    { field: "quantity", row: 0, before: "2400", after: null },
  ]);
});