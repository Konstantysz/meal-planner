import { normalizeUnit } from './import/unit';
import type { Macros } from './types';

export interface IngredientMacroInput {
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
}

export function hasMacros(ingredient: IngredientMacroInput): boolean {
  const { kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g } = ingredient;
  return [kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g].some((v) => v !== null);
}

export function calculateIngredientMacros(ingredient: IngredientMacroInput, grams: number): Macros | null {
  if (!hasMacros(ingredient)) return null;
  const { kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g } = ingredient;
  const f = grams / 100;
  return {
    kcal: (kcal_per_100g ?? 0) * f,
    protein: (protein_per_100g ?? 0) * f,
    fat: (fat_per_100g ?? 0) * f,
    carbs: (carbs_per_100g ?? 0) * f,
  };
}

export function sumMacros(list: (Macros | null)[]): Macros {
  return list.reduce<Macros>(
    (acc, m) =>
      m === null
        ? acc
        : {
            kcal: acc.kcal + m.kcal,
            protein: acc.protein + m.protein,
            fat: acc.fat + m.fat,
            carbs: acc.carbs + m.carbs,
          },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

export function perServing(total: Macros, servings: number): Macros | null {
  if (servings <= 0) return null;
  return {
    kcal: total.kcal / servings,
    protein: total.protein / servings,
    fat: total.fat / servings,
    carbs: total.carbs / servings,
  };
}

// Grams per one unit, for units that are a plain multiple of a gram or a millilitre.
// Volume assumes 1 ml = 1 g (water density) for every ingredient; per-ingredient density is #74.
const GRAMS_PER_UNIT: Record<string, number> = {
  mg: 0.001,
  g: 1,
  gr: 1,
  dag: 10,
  dkg: 10,
  kg: 1000,
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
};

/**
 * Weight in grams of `amount` `unit`, or null when the unit is not a mass or volume multiple (łyżka, szt, …).
 * Accepts Polish abbreviations (dkg, gr), one trailing dot ("kg.") and, as a fallback, the inflected forms
 * `normalizeUnit` maps ("gramów", "litra"). `normalizeUnit` itself stays unchanged: it maps model output onto
 * stored units and is measured by the evals.
 */
export function toGrams(amount: number, unit: string | null): number | null {
  if (unit === null) return null;
  const key = unit.trim().toLowerCase().replace(/\.$/, '');
  const exact = GRAMS_PER_UNIT[key];
  if (exact !== undefined) return amount * exact;
  // Fallback for one inflected word only: normalizeUnit lets the last unit-like word win, so a multi-word
  // unit such as "szklanka 250 ml" would read as ml and hide a household measure.
  if (/\s/.test(key)) return null;
  const canonical = normalizeUnit(key);
  const factor = canonical === null ? undefined : GRAMS_PER_UNIT[canonical];
  return factor === undefined ? null : amount * factor;
}

/** Why a recipe ingredient was left out of a macro total. */
export type LeftOutReason = 'no_macros' | 'unit' | 'no_amount';

export interface LeftOutIngredient {
  name: string;
  reason: LeftOutReason;
}

/** One recipe ingredient as far as macros need it. `ingredients` is null when the row is missing or hidden by RLS. */
export interface MacroRecipeIngredient {
  amount: number | null;
  unit: string | null;
  optional: boolean;
  /**
   * Fallback name for the left-out list when the ingredient row has no name. Names come only from what the
   * caller selected: the plan query selects neither `name` nor `raw_text`, so its left-out names would all read
   * "składnik" (day totals don't show names).
   */
  raw_text?: string;
  ingredients: (IngredientMacroInput & { name?: string }) | null;
}

export interface RecipeMacros {
  /** Sum over the counted ingredients for the whole base recipe; a lower bound when `complete` is false. */
  total: Macros;
  /** `total` divided by the base servings; null when nothing was counted or servings are 0 or fewer. */
  perServing: Macros | null;
  /** True when every non-optional ingredient was counted and at least one was. */
  complete: boolean;
  /** Non-optional ingredients that are not in `total`, in input order. */
  leftOut: LeftOutIngredient[];
}

/**
 * Macros of a recipe that tell "unknown" apart from "zero". An ingredient is left out, with a reason, when it
 * has no macros (the same `hasMacros` test the shopping list uses for „brak makro"), no amount, or a unit
 * `toGrams` cannot convert. Optional ingredients are skipped and not reported.
 */
export function recipeMacros(ingredients: MacroRecipeIngredient[], servings: number): RecipeMacros {
  const leftOut: LeftOutIngredient[] = [];
  const parts: Macros[] = [];
  for (const ri of ingredients) {
    if (ri.optional) continue;
    const name = ri.ingredients?.name?.trim() || ri.raw_text?.trim() || 'składnik';
    if (!ri.ingredients || !hasMacros(ri.ingredients)) {
      leftOut.push({ name, reason: 'no_macros' });
      continue;
    }
    if (ri.amount === null) {
      leftOut.push({ name, reason: 'no_amount' });
      continue;
    }
    const grams = toGrams(ri.amount, ri.unit);
    if (grams === null) {
      leftOut.push({ name, reason: 'unit' });
      continue;
    }
    const m = calculateIngredientMacros(ri.ingredients, grams);
    if (m) parts.push(m);
  }
  const total = sumMacros(parts);
  return {
    total,
    perServing: parts.length > 0 ? perServing(total, servings) : null,
    complete: parts.length > 0 && leftOut.length === 0,
    leftOut,
  };
}
