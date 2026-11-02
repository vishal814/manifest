import { z } from "zod";

export const shipmentSchema = z.object({
  reference: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens or underscores."),
  supplier: z.string().trim().min(2).max(160),
});
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});
export const documentKindSchema = z.enum(["invoice", "packing_list", "bill_of_lading"]);
export const uuidSchema = z.uuid();

export const extractedFieldSchema = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  sourcePage: z.number().int().min(1).max(10).nullable(),
  evidence: z.string().max(1000).nullable(),
});
const fields = z.object({
  supplier: extractedFieldSchema,
  buyer: extractedFieldSchema,
  invoiceNumber: extractedFieldSchema,
  invoiceDate: extractedFieldSchema,
  currency: extractedFieldSchema,
  incoterm: extractedFieldSchema,
  invoiceTotal: extractedFieldSchema,
  packageCount: extractedFieldSchema,
  grossWeightKg: extractedFieldSchema,
  netWeightKg: extractedFieldSchema,
  containerNumbers: extractedFieldSchema,
});
export const extractionSchema = z.object({
  fields,
  items: z.array(z.object({
    description: extractedFieldSchema,
    hsn: extractedFieldSchema,
    quantity: extractedFieldSchema,
    unitPrice: extractedFieldSchema,
    lineTotal: extractedFieldSchema,
  })).max(200),
  warnings: z.array(z.string().max(500)).max(30),
});
export type ExtractionResult = z.infer<typeof extractionSchema>;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export function validateFileMetadata(file: { size: number; type: string }) {
  if (!file.size) return "The file is empty.";
  if (file.size > MAX_FILE_BYTES) return "Choose a file smaller than 10 MB.";
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return "Upload a PDF, JPG or PNG file.";
  return null;
}

export function detectFileType(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  return null;
}
