import { z } from "zod";
import { extractionSchema, uuidSchema } from "./validation";

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

export const savedReview = z.object({
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

