import { describe, expect, it } from "vitest";
import { checkShipmentDocuments, decimalUnits, packageCount, type CheckDocument } from "../src/lib/cross-checks";
import { equivalentField, reviewAgreement } from "../src/lib/accuracy";
import { blankExtraction } from "../src/lib/manual-entry";
import { boundedFormData, BodyTooLarge } from "../src/lib/bounded-body";
const docs = (): CheckDocument[] => ["invoice", "packing_list", "bill_of_lading"].map(kind => ({ kind, fields: { grossWeightKg: "420", netWeightKg: kind === "bill_of_lading" ? null : "390", packageCount: "30", currency: "USD", invoiceTotal: "0.30" }, items: [{ lineTotal: "0.10" }, { lineTotal: "0.20" }] }));
const status = (documents: CheckDocument[], id: string) => checkShipmentDocuments(documents).find(check => check.id === id)!.status;
describe("full shipment cross-checks", () => {
  it("adds decimal money exactly without floating point drift", () => { expect(status(docs(), "invoice_total")).toBe("match"); });
  it("flags package differences even before all three documents are available", () => {
    const sample = docs(); sample[1].fields.packageCount = "31 cartons";
    expect(status(sample, "packages")).toBe("mismatch"); expect(status(sample.slice(0, 2), "packages")).toBe("mismatch");
  });
  it.each([null, "", "30.5", "0", "30,00", "thirty", "-3"])("keeps invalid package count %s pending", value => {
    const sample = docs(); sample[1].fields.packageCount = value; expect(status(sample, "packages")).toBe("pending");
  });
  it("parses supported whole package formats", () => { expect(packageCount("1,200 cartons")).toBe(1200); });
  it("compares net weights only where stated and flags malformed provided values", () => {
    const sample = docs(); expect(status(sample, "net_weight")).toBe("match");
    sample[1].fields.netWeightKg = "389"; expect(status(sample, "net_weight")).toBe("mismatch");
    sample[1].fields.netWeightKg = null; expect(status(sample, "net_weight")).toBe("not_applicable");
    sample[1].fields.netWeightKg = "unknown"; expect(status(sample, "net_weight")).toBe("pending");
  });
  it("flags invoice arithmetic differences and requires every line total", () => {
    const sample = docs(); sample[0].fields.invoiceTotal = "0.31"; expect(status(sample, "invoice_total")).toBe("mismatch");
    sample[0].items[1].lineTotal = null; expect(status(sample, "invoice_total")).toBe("pending");
    sample[0].items = []; expect(status(sample, "invoice_total")).toBe("pending");
  });
  it("rejects foreign currency prefixes, negatives and unsafe precision", () => {
    expect(decimalUnits("EUR 10", "USD")).toBeNull(); expect(decimalUnits("-10")).toBeNull(); expect(decimalUnits("1.1234567")).toBeNull();
    expect(decimalUnits("USD 2,750.00", "USD")).toBe(2750000000n);
  });
});
describe("manual review and quality reporting", () => {
  it("creates validated empty forms without inventing AI confidence", () => {
    const form = blankExtraction(2); expect(form.items).toHaveLength(2); expect(form.fields.supplier.confidence).toBe(0); expect(form.fields.supplier.value).toBeNull();
    expect(() => blankExtraction(0)).toThrow(); expect(() => blankExtraction(201)).toThrow();
  });
  it("normalizes equivalent number formats but retains real errors", () => {
    expect(equivalentField("grossWeightKg", "3.12 tonnes", "3120")).toBe(true);
    expect(equivalentField("invoiceTotal", "2,750.00", "2750")).toBe(true);
    expect(equivalentField("invoiceNumber", "001", "1")).toBe(false);
  });
  it("measures corrections by field and supplier, excluding blank pairs and manual records", () => {
    const ai = blankExtraction(1); ai.warnings = []; ai.fields.supplier.value = "Test Supplier"; ai.fields.grossWeightKg.value = "10";
    const review = { fields: Object.fromEntries(Object.entries(ai.fields).map(([key, value]) => [key, value.value])), items: ai.items.map(item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value.value]))), revision: "1b82a2c8-7b4d-49c9-a318-b8a4a8bdb390", savedBy: "1b82a2c8-7b4d-49c9-a318-b8a4a8bdb390", savedAt: "2026-11-06T00:00:00.000Z" };
    review.fields.grossWeightKg = "12";
    const result = reviewAgreement([{ supplier: "Supplier A", result: { ...ai, review } }, { supplier: "Manual", result: { ...blankExtraction(1), review } }]);
    expect(result.reviewedDocuments).toBe(1); expect(result.suppliers).toEqual([{ name: "Supplier A", compared: 2, agreed: 1 }]);
    expect(result.fields.find(field => field.name === "grossWeightKg")?.agreed).toBe(0);
  });
});
describe("bounded upload bodies", () => {
  it("rejects an oversized stream even when Content-Length is omitted", async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(101)); controller.close(); } });
    const request = new Request("https://test.example/upload", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(boundedFormData(request, 100)).rejects.toBeInstanceOf(BodyTooLarge);
  });
  it("parses a valid multipart stream below the limit", async () => {
    const form = new FormData(); form.set("kind", "invoice");
    const request = new Request("https://test.example/upload", { method: "POST", body: form });
    expect((await boundedFormData(request, 1000)).get("kind")).toBe("invoice");
  });
});
