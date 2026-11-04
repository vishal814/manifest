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
