import type { IngredientMacroInput } from './macros';

/**
 * Plausibility rules for ingredient macros (per 100 g). The range rules are also CHECK constraints on
 * `ingredients` (migration 0012); keep the two in step. The Atwater rule is app-only: alcohol and
 * fibre-rich spices legitimately miss it, so it only filters Open Food Facts results.
 */
export const MACRO_LIMITS = {
  /** Protein, fat and carbs each: 0..100 g per 100 g. */
  maxGrams: 100,
  /** Protein + fat + carbs: at most 100 g, plus 1 g for label rounding. */
  maxSum: 101,
  /** Pure fat is ~900 kcal per 100 g. */
  maxKcal: 900,
} as const;

/** kcal per gram of protein, fat and carbs (Atwater general factors). */
export const ATWATER_FACTORS = { protein: 4, fat: 9, carbs: 4 } as const;

/** Stated kcal must lie within these multiples of the Atwater estimate… */
export const ATWATER_RATIO = { min: 0.6, max: 1.2 } as const;
/** …or within this many kcal of it, so near-zero rows (coffee, broth, salt) are not judged by a ratio. */
export const ATWATER_SLACK_KCAL = 10;

export type MacroIssue = 'kcal_range' | 'protein_range' | 'fat_range' | 'carbs_range' | 'macro_sum' | 'atwater';

/** Atwater kcal estimate (4/9/4 per gram), or null when protein, fat or carbs is missing. */
export function atwaterKcal(m: IngredientMacroInput): number | null {
  const { protein_per_100g: p, fat_per_100g: f, carbs_per_100g: c } = m;
  if (p == null || f == null || c == null) return null;
  return p * ATWATER_FACTORS.protein + f * ATWATER_FACTORS.fat + c * ATWATER_FACTORS.carbs;
}

const inRange = (v: number | null, max: number) => v == null || (v >= 0 && v <= max);

/**
 * Every rule the macros break; an empty list means valid. Null values are not judged (a macro-less or
 * partly filled ingredient is allowed). With `atwater: true` (Open Food Facts results) the stated kcal
 * must also agree with the Atwater estimate. Without kcal there is nothing to judge; with kcal but some of
 * protein, fat or carbs missing, the present ones give a lower bound (kcal below 0.6× their estimate minus
 * the slack is rejected, no upper bound).
 * An alcohol-like row (kcal but no protein, fat or carbs) fails the Atwater rule but passes the range rules,
 * so it can be saved by hand but is skipped as an Open Food Facts result.
 */
export function validateMacros(m: IngredientMacroInput, opts: { atwater?: boolean } = {}): MacroIssue[] {
  const issues: MacroIssue[] = [];
  if (!inRange(m.kcal_per_100g, MACRO_LIMITS.maxKcal)) issues.push('kcal_range');
  if (!inRange(m.protein_per_100g, MACRO_LIMITS.maxGrams)) issues.push('protein_range');
  if (!inRange(m.fat_per_100g, MACRO_LIMITS.maxGrams)) issues.push('fat_range');
  if (!inRange(m.carbs_per_100g, MACRO_LIMITS.maxGrams)) issues.push('carbs_range');
  const sum = (m.protein_per_100g ?? 0) + (m.fat_per_100g ?? 0) + (m.carbs_per_100g ?? 0);
  if (sum > MACRO_LIMITS.maxSum) issues.push('macro_sum');

  if (opts.atwater && m.kcal_per_100g != null) {
    const kcal = m.kcal_per_100g;
    const estimate = atwaterKcal(m);
    if (estimate != null) {
      const close = Math.abs(kcal - estimate) <= ATWATER_SLACK_KCAL;
      const ratioOk = estimate > 0 && kcal >= estimate * ATWATER_RATIO.min && kcal <= estimate * ATWATER_RATIO.max;
      if (!close && !ratioOk) issues.push('atwater');
    } else {
      // Some macros missing: the present ones still give a lower bound for kcal.
      const partial = atwaterKcal({
        ...m,
        protein_per_100g: m.protein_per_100g ?? 0,
        fat_per_100g: m.fat_per_100g ?? 0,
        carbs_per_100g: m.carbs_per_100g ?? 0,
      });
      if (partial != null && kcal < partial * ATWATER_RATIO.min - ATWATER_SLACK_KCAL) issues.push('atwater');
    }
  }
  return issues;
}
