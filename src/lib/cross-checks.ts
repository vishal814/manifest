export function grossWeightKg(value: string | null | undefined): number | null {
  const match = value?.trim().match(/^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(kg|kilograms?|g|grams?|t|tonnes?|metric tons?|lbs?|pounds?)?$/i);
  if (!match) return null;

  const amount = Number(match[1].replaceAll(",", "") + (match[2] ?? ""));
  const unit = match[3]?.toLowerCase();
  let multiplier = 1;
  if (unit === "g" || unit?.startsWith("gram")) multiplier = 0.001;
  if (unit === "t" || unit?.startsWith("tonne") || unit?.startsWith("metric")) multiplier = 1000;
  if (unit?.startsWith("lb") || unit?.startsWith("pound")) multiplier = 0.45359237;
  const weight = amount * multiplier;
  return Number.isFinite(weight) && weight <= Number.MAX_SAFE_INTEGER ? Number(weight.toPrecision(15)) : null;
}

export function compareGrossWeights(weights: (number | null)[]) {
  const available = weights.filter((weight): weight is number => weight !== null);
  const difference = available.length >= 2 ? Math.max(...available) - Math.min(...available) : 0;
  if (difference > 0) return { status: "mismatch", difference } as const;
  if (available.length < weights.length || available.length < 2) return { status: "pending" } as const;
  return { status: "match" } as const;
}


export function packageCount(value: string | null | undefined): number | null {
  const match = value?.trim().match(/^(\d{1,3}(?:,\d{3})+|\d+)\s*(?:packages?|cartons?|boxes?|pallets?|pkgs?|ctns?)?$/i);
  if (!match) return null;
  const count = Number(match[1].replaceAll(",", ""));
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

// Fixed six-place integers avoid floating point errors in monetary addition.
export function decimalUnits(value: string | null | undefined, currency?: string | null): bigint | null {
  if (!value) return null;
  let text = value.trim();
  const code = text.match(/^([A-Z]{3})\s+/i);
  if (code) {
    if (!currency || code[1].toUpperCase() !== currency.trim().toUpperCase()) return null;
    text = text.slice(code[0].length);
  }
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,6})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  if (whole.length > 12) return null;
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export type CheckDocument = {
  kind: string;
  fields: Record<string, string | null>;
  items: Record<string, string | null>[];
};
export type ShipmentCheck = {
  id: string;
  label: string;
  status: "match" | "mismatch" | "pending" | "not_applicable";
  message: string;
};

export function checkShipmentDocuments(documents: CheckDocument[]): ShipmentCheck[] {
  const ordered = ["invoice", "packing_list", "bill_of_lading"].map(kind => documents.find(doc => doc.kind === kind));
  const weight = compareGrossWeights(ordered.map(doc => grossWeightKg(doc?.fields.grossWeightKg)));
  const packages = compareGrossWeights(ordered.map(doc => packageCount(doc?.fields.packageCount)));
  const netValues = ordered.map(doc => doc?.fields.netWeightKg);
  const net = compareGrossWeights(netValues.map(grossWeightKg));
  const providedNet = netValues.filter(value => value?.trim()).length;
  const badNet = netValues.some(value => value?.trim() && grossWeightKg(value) === null);
  const invoice = ordered[0];
  const currency = invoice?.fields.currency?.trim().toUpperCase();
  const total = currency && /^[A-Z]{3}$/.test(currency) ? decimalUnits(invoice?.fields.invoiceTotal, currency) : null;
  const lines = invoice?.items.map(item => decimalUnits(item.lineTotal, currency)) ?? [];
  const validLines = lines.length > 0 && lines.every(line => line !== null);
  const sum = lines.reduce<bigint>((value, line) => value + (line ?? 0n), 0n);
  const arithmetic = total === null || !validLines ? "pending" : total === sum ? "match" : "mismatch";
  const money = (value: bigint) => (value / 1_000_000n).toString() + "." + (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
  const invoiceMessage = arithmetic === "pending" ? "Enter invoice currency, total and a total for every invoice line item." : `Invoice total: ${currency} ${money(total!)}. Line-item sum: ${currency} ${money(sum)}. ${arithmetic === "match" ? "Totals match." : "Totals differ; check charges, taxes and source values."}`;
  const netStatus = badNet ? "pending" : providedNet < 2 ? "not_applicable" : net.status === "mismatch" ? "mismatch" : "match";
  return [
    { id: "gross_weight", label: "Gross weight", status: weight.status, message: weight.status === "mismatch" ? "Gross weights differ across documents." : weight.status === "pending" ? "Enter a valid gross weight in all three documents." : "Gross weights match." },
    { id: "net_weight", label: "Net weight", status: netStatus, message: netStatus === "not_applicable" ? "Fewer than two documents state a net weight; no comparison is possible." : netStatus === "pending" ? "Correct the invalid net weight value." : netStatus === "mismatch" ? "Net weights differ across documents that state them." : "Available net weights match." },
    { id: "packages", label: "Package count", status: packages.status, message: packages.status === "pending" ? "Enter a positive whole package count in all three documents." : packages.status === "mismatch" ? "Package counts differ across documents." : "Package counts match across all three documents." },
    { id: "invoice_total", label: "Invoice total vs line-item sum", status: arithmetic, message: invoiceMessage },
  ];
}
