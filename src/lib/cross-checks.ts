export function grossWeightKg(value: string | null | undefined): number | null {
  const text = value?.trim().replace(/\s*kg$/i, "");
  if (!text || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) return null;

  const weight = Number(text.replaceAll(",", ""));
  return Number.isFinite(weight) && weight <= Number.MAX_SAFE_INTEGER ? weight : null;
}

export function compareGrossWeights(weights: (number | null)[]) {
  const available = weights.filter((weight): weight is number => weight !== null);
  const difference = available.length >= 2 ? Math.max(...available) - Math.min(...available) : 0;
  if (difference > 0) return { status: "mismatch", difference } as const;
  if (available.length < weights.length || available.length < 2) return { status: "pending" } as const;
  return { status: "match" } as const;
}
