const DEFAULT_SERVINGS = 4;
const ASSUMED_SERVING_GRAMS = 350;

/** Total weight in grams when the yield is given only by weight ("1,5 kg"); null if an explicit count is present. */
export function yieldWeightGrams(y: string | number | undefined): number | null {
  if (typeof y !== 'string' || /(\d+)\s*(?:porcj|os|szt)/i.test(y)) return null;
  // (?![a-z]) rather than \b: "gramów" must match, "garście" must not.
  const weight = y.match(/(\d+(?:[.,]\d+)?)\s*(kg|gram|g)(?![a-z])/i);
  if (!weight) return null;
  return Number(weight[1].replace(',', '.')) * (weight[2].toLowerCase() === 'kg' ? 1000 : 1);
}

/** recipeYield ("4 porcje", "1,5 kg", 6) → servings. An explicit count wins over a weight. */
export function parseYield(y: string | number | undefined): number {
  if (typeof y === 'number') return Math.max(1, Math.round(y));
  if (!y) return DEFAULT_SERVINGS;
  const count = y.match(/(\d+)\s*(?:porcj|os|szt)/i);
  if (count) return Math.max(1, Number(count[1]));
  const grams = yieldWeightGrams(y);
  if (grams !== null) return Math.max(1, Math.round(grams / ASSUMED_SERVING_GRAMS));
  const m = y.match(/(\d+)/);
  return m ? Math.max(1, Number(m[1])) : DEFAULT_SERVINGS;
}
