export interface StructuredAmount {
  amount: number | null;
  unit: string | null;
  raw_text: string;
}

/** A stored amount is null or > 0 (DB check, migration 0013): 0, negatives and NaN become null ("no amount"). */
export function positiveAmountOrNull(amount: number | null | undefined): number | null {
  return amount != null && amount > 0 ? amount : null;
}

export function roundForUnit(amount: number, unit: string | null): number {
  const u = unit?.toLowerCase() ?? '';
  if (u === 'g' || u === 'ml') return Math.round(amount);
  if (u === 'kg' || u === 'l') return Math.round(amount * 100) / 100;
  return Math.round(amount * 100) / 100;
}

export function formatAmount(amount: number, unit: string | null): string {
  const r = roundForUnit(amount, unit);
  return unit ? `${r} ${unit}` : `${r}`;
}

export function scaleAmount(item: StructuredAmount, factor: number): StructuredAmount {
  if (item.amount === null) return { ...item };
  const scaled = item.amount * factor;
  return {
    amount: scaled,
    unit: item.unit,
    raw_text: formatAmount(scaled, item.unit),
  };
}
