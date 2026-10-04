const DEFAULT_SERVINGS = 4;
const ASSUMED_SERVING_GRAMS = 350;

/** recipeYield ("4 porcje", "1,5 kg", 6) → servings. An explicit count wins over a weight. */
export function parseYield(y: string | number | undefined): number {
  if (typeof y === 'number') return Math.max(1, Math.round(y));
  if (!y) return DEFAULT_SERVINGS;
  const count = y.match(/(\d+)\s*(?:porcj|os|szt)/i);
  if (count) return Math.max(1, Number(count[1]));
  // (?![a-z]) rather than \b: "gramów" must match, "garście" must not.
  const weight = y.match(/(\d+(?:[.,]\d+)?)\s*(kg|gram|g)(?![a-z])/i);
  if (weight) {
    const grams = Number(weight[1].replace(',', '.')) * (weight[2].toLowerCase() === 'kg' ? 1000 : 1);
    return Math.max(1, Math.round(grams / ASSUMED_SERVING_GRAMS));
  }
  const m = y.match(/(\d+)/);
  return m ? Math.max(1, Number(m[1])) : DEFAULT_SERVINGS;
}
