import { decimalUnits, grossWeightKg, packageCount } from "./cross-checks";
import { readReview } from "./review";
import { extractionSchema } from "./validation";

export function equivalentField(field: string, left: string | null, right: string | null): boolean {
  const normalize = (text: string | null) => text?.trim().replace(/\s+/g, " ").toLowerCase() || null;
  if (normalize(left) === normalize(right)) return true;
  if (field === "grossWeightKg" || field === "netWeightKg") {
    const a = grossWeightKg(left), b = grossWeightKg(right);
    return a !== null && b !== null && a === b;
  }
  if (field === "packageCount") {
    const a = packageCount(left), b = packageCount(right);
    return a !== null && b !== null && a === b;
  }
  if (["invoiceTotal", "quantity", "unitPrice", "lineTotal"].includes(field)) {
    const strip = (text: string | null) => text?.replace(/^[A-Z]{3}\s+/i, "");
    const a = decimalUnits(strip(left)), b = decimalUnits(strip(right));
    return a !== null && b !== null && a === b;
  }
  return false;
}

type Counter = { name: string; compared: number; agreed: number };
export function reviewAgreement(entries: { supplier: string; result: unknown }[]) {
  const fields = new Map<string, Counter>(), suppliers = new Map<string, Counter>();
  let reviewedDocuments = 0;
  const add = (map: Map<string, Counter>, name: string, agreed: boolean) => {
    const count = map.get(name) ?? { name, compared: 0, agreed: 0 };
    count.compared++; if (agreed) count.agreed++; map.set(name, count);
  };
  for (const entry of entries) {
    const parsed = extractionSchema.safeParse(entry.result), review = readReview(entry.result);
    if (!parsed.success || !review || parsed.data.warnings.includes("Manual entry: no AI extraction was used.")) continue;
    reviewedDocuments++;
    const compare = (key: string, original: string | null, final: string | null) => {
      if (!original?.trim() && !final?.trim()) return;
      const agreed = equivalentField(key, original, final);
      add(fields, key, agreed); add(suppliers, entry.supplier, agreed);
    };
    for (const [key, field] of Object.entries(parsed.data.fields)) compare(key, field.value, review.fields[key]);
    parsed.data.items.forEach((item, index) => {
      for (const [key, field] of Object.entries(item)) compare(key, field.value, review.items[index]?.[key] ?? null);
    });
  }
  return { reviewedDocuments, fields: [...fields.values()].sort((a, b) => a.name.localeCompare(b.name)), suppliers: [...suppliers.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}
