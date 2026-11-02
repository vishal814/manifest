import { describe, expect, it } from "vitest";
import { detectFileType, extractionSchema, MAX_FILE_BYTES, shipmentSchema, validateFileMetadata } from "../src/lib/validation";

describe("shipment validation", () => {
  it("normalizes surrounding spaces", () => {
    expect(shipmentSchema.parse({ reference: " SHP-24811 ", supplier: " Company B " })).toEqual({ reference: "SHP-24811", supplier: "Company B" });
  });
  it.each(["../secret", "shipment with spaces", "<script>", "AB"])("rejects unsafe or invalid reference %s", reference => {
    expect(shipmentSchema.safeParse({ reference, supplier: "Company B" }).success).toBe(false);
  });
  it("rejects empty suppliers", () => expect(shipmentSchema.safeParse({ reference: "SHP-24811", supplier: "  " }).success).toBe(false));
});

describe("upload validation", () => {
  it("rejects empty files", () => expect(validateFileMetadata({ size: 0, type: "application/pdf" })).toContain("empty"));
  it("rejects files exceeding the limit", () => expect(validateFileMetadata({ size: MAX_FILE_BYTES + 1, type: "application/pdf" })).toContain("10 MB"));
  it("rejects executable file metadata", () => expect(validateFileMetadata({ size: 100, type: "application/x-msdownload" })).not.toBeNull());
  it("accepts a permitted size and type", () => expect(validateFileMetadata({ size: 1024, type: "application/pdf" })).toBeNull());
  it("detects a PDF from its signature", () => expect(detectFileType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf"));
  it("rejects a renamed executable", () => expect(detectFileType(new TextEncoder().encode("MZprogram.pdf"))).toBeNull());
  it("rejects a truncated PNG signature", () => expect(detectFileType(new Uint8Array([137,80,78,71]))).toBeNull());
});

describe("AI output validation", () => {
  const missing = { value: null, confidence: 0, sourcePage: null, evidence: null };
  const result = () => ({ fields: Object.fromEntries(["supplier","buyer","invoiceNumber","invoiceDate","currency","incoterm","invoiceTotal","packageCount","grossWeightKg","netWeightKg","containerNumbers"].map(key => [key, { ...missing }])), items: [], warnings: [] });
  it("accepts explicit missing values for human review", () => expect(extractionSchema.safeParse(result()).success).toBe(true));
  it("rejects confidence outside 0..1", () => {
    const data = result(); data.fields.supplier.confidence = 1.2;
    expect(extractionSchema.safeParse(data).success).toBe(false);
  });
  it("rejects incomplete extraction structures", () => expect(extractionSchema.safeParse({ fields: { supplier: missing } }).success).toBe(false));
  it("rejects source pages outside the upload limit", () => {
    const data = result() as unknown as { fields: Record<string, { sourcePage: number | null }>; items: never[]; warnings: never[] };
    data.fields.supplier.sourcePage = 99;
    expect(extractionSchema.safeParse(data).success).toBe(false);
  });
});
