import { describe, expect, it } from "vitest";
import { readReview, reviewRequest } from "../src/lib/review";
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
