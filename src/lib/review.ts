import { z } from "zod";
import { extractionSchema, uuidSchema, type ExtractionResult } from "./validation";

const value = z.string().trim().max(1000).transform(text => text || null);
const fields = z.object(Object.fromEntries(Object.keys(extractionSchema.shape.fields.shape).map(key => [key, value])));
const item = z.object(Object.fromEntries(Object.keys(extractionSchema.shape.items.element.shape).map(key => [key, value])));
const values = z.object({ fields, items: z.array(item).max(200) });

export const reviewRequest = values.extend({
  runId: uuidSchema,
  revision: uuidSchema.nullable(),
});

const storedValue = z.string().max(1000).nullable();
const storedFields = z.object(Object.fromEntries(Object.keys(fields.shape).map(key => [key, storedValue])));
const storedItem = z.object(Object.fromEntries(Object.keys(item.shape).map(key => [key, storedValue])));

const changeSet = z.object({
  revision: uuidSchema,
  savedAt: z.iso.datetime(),
  savedBy: uuidSchema,
  changes: z.array(z.object({
    field: z.string(),
    row: z.number().int().nonnegative().optional(),
    before: z.string().nullable(),
    after: storedValue,
  })),
});

export const savedReview = z.object({
  history: z.array(changeSet).default([]),
  fields: storedFields,
  items: z.array(storedItem).max(200),
  revision: uuidSchema,
  savedAt: z.iso.datetime(),
  savedBy: uuidSchema,
});
export type SavedReview = z.infer<typeof savedReview>;

export function readReview(result: unknown) {
  const parsed = z.object({ review: savedReview }).safeParse(result);
  return parsed.success ? parsed.data.review : null;
}


export function reviewChanges(
  extraction: ExtractionResult,
  current: SavedReview | null,
  next: Pick<SavedReview, "fields" | "items">,
) {
  const changes: z.infer<typeof changeSet>["changes"] = [];
  for (const [field, extracted] of Object.entries(extraction.fields)) {
    const before = current ? current.fields[field] : extracted.value;
    const after = next.fields[field];
    if (before !== after) changes.push({ field, before, after });
  }
  for (const [row, item] of extraction.items.entries()) {
    for (const [field, extracted] of Object.entries(item)) {
      const before = current ? current.items[row][field] : extracted.value;
      const after = next.items[row][field];
      if (before !== after) changes.push({ field, row, before, after });
    }
  }
  return changes;
}
export const reviewFieldLabels: Record<string, string> = {
  supplier: "Supplier", buyer: "Buyer", invoiceNumber: "Invoice number",
  invoiceDate: "Invoice date", currency: "Currency", incoterm: "Incoterm",
  invoiceTotal: "Invoice total", packageCount: "Packages", grossWeightKg: "Gross weight (kg)",
  netWeightKg: "Net weight (kg)", containerNumbers: "Containers",
  description: "Description", hsn: "HSN", quantity: "Quantity", unitPrice: "Unit price", lineTotal: "Line total",
};
