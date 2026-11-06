import { extractionSchema, type ExtractionResult } from "./validation";
export function blankExtraction(lineCount: number): ExtractionResult {
  if (!Number.isInteger(lineCount) || lineCount < 1 || lineCount > 200) throw new Error("Invalid line count");
  const blank = () => ({ value: null, confidence: 0, sourcePage: null, evidence: null });
  return extractionSchema.parse({
    fields: Object.fromEntries(Object.keys(extractionSchema.shape.fields.shape).map(key => [key, blank()])),
    items: Array.from({ length: lineCount }, () => Object.fromEntries(Object.keys(extractionSchema.shape.items.element.shape).map(key => [key, blank()]))),
    warnings: ["Manual entry: no AI extraction was used."],
  });
}
