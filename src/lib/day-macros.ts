import { recipeMacros, sumMacros, type MacroRecipeIngredient } from './macros';
import type { Macros } from './types';

/** One recipe ingredient as the plan query returns it (the joined `ingredients` row is null when RLS hides it). */
export type PlannedRecipeIngredient = MacroRecipeIngredient;

export interface DaySlotInput {
  date: string;
  recipe_id: string | null;
  servings: number;
  recipe: { servings_base: number; ingredients?: PlannedRecipeIngredient[] } | null;
}

export interface DayMacros {
  /** Sum over the day's slots; only days with a recipe slot appear at all. */
  macros: Macros;
  /** True when at least one slot added macros, so `macros` is more than a placeholder zero. */
  known: boolean;
  /** True when something was left out (see `recipeMacros` in `macros.ts`): `macros` is a lower bound. */
  incomplete: boolean;
}

/**
 * Per-day macro totals for a week: for each slot with a recipe, the recipe's per-serving macros (`recipeMacros`)
 * times the planned servings. Works on rows already fetched in one query, so it adds no per-slot requests.
 * Only dates that have a slot with a recipe appear in the result.
 */
export function computeDayMacros(slots: DaySlotInput[]): Record<string, DayMacros> {
  const days: Record<string, DayMacros> = {};
  for (const slot of slots) {
    if (!slot.recipe_id) continue;
    const day = (days[slot.date] ??= { macros: sumMacros([]), known: false, incomplete: false });
    const recipe = slot.recipe?.ingredients ? recipeMacros(slot.recipe.ingredients, slot.recipe.servings_base) : null;
    const base = recipe?.perServing ?? null;
    // Unavailable recipe, nothing counted, bad servings_base or an invalid planned servings count: nothing to add.
    if (!recipe || !base || !(slot.servings > 0)) {
      day.incomplete = true;
      continue;
    }
    if (!recipe.complete) day.incomplete = true;
    day.known = true;
    day.macros = sumMacros([
      day.macros,
      {
        kcal: base.kcal * slot.servings,
        protein: base.protein * slot.servings,
        fat: base.fat * slot.servings,
        carbs: base.carbs * slot.servings,
      },
    ]);
  }
  return days;
}
