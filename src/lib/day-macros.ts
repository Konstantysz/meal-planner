import { calculateIngredientMacros, hasMacros, perServing, sumMacros, type IngredientMacroInput } from './macros';
import type { Macros } from './types';

/** One recipe ingredient as the plan query returns it (the joined `ingredients` row is null when RLS hides it). */
export interface PlannedRecipeIngredient {
  amount: number | null;
  unit: string | null;
  optional: boolean;
  ingredients: IngredientMacroInput | null;
}

export interface DaySlotInput {
  date: string;
  recipe_id: string | null;
  servings: number;
  recipe: { servings_base: number; ingredients?: PlannedRecipeIngredient[] } | null;
}

export interface DayMacros {
  /** Sum over the day's slots; only days with a recipe slot appear at all. */
  macros: Macros;
  /** True when something was left out or counted as 0 (see `recipeMacros`): the total is a lower bound. */
  incomplete: boolean;
}

/** Macros of one base recipe (not per serving) and whether every counted ingredient had usable data. */
export function recipeMacros(ingredients: PlannedRecipeIngredient[]): { total: Macros; incomplete: boolean } {
  let incomplete = ingredients.every((ri) => ri.optional);
  const parts = ingredients.map((ri) => {
    if (ri.optional) return null;
    // Same rules as the recipe page: only g and ml carry a weight, any other unit adds 0.
    const weighed = (ri.unit === 'g' || ri.unit === 'ml') && ri.amount !== null;
    if (!ri.ingredients || !hasMacros(ri.ingredients) || !weighed) {
      incomplete = true;
      return null;
    }
    return calculateIngredientMacros(ri.ingredients, ri.amount ?? 0);
  });
  return { total: sumMacros(parts), incomplete };
}

/**
 * Per-serving macros of a recipe for the list and the detail page. Null (UI: „brak danych makro") when any
 * counted ingredient lacked data or `servingsBase` is invalid: the same rule as the day totals, so a partial
 * sum never reads as a real value.
 */
export function recipePerServing(ingredients: PlannedRecipeIngredient[], servingsBase: number): Macros | null {
  const { total, incomplete } = recipeMacros(ingredients);
  return incomplete ? null : perServing(total, servingsBase);
}

/**
 * Per-day macro totals for a week: for each slot with a recipe, the recipe's per-serving macros times the
 * planned servings. Works on rows already fetched in one query, so it adds no per-slot requests.
 * Only dates that have a slot with a recipe appear in the result.
 */
export function computeDayMacros(slots: DaySlotInput[]): Record<string, DayMacros> {
  const days: Record<string, DayMacros> = {};
  for (const slot of slots) {
    if (!slot.recipe_id) continue;
    const day = (days[slot.date] ??= { macros: sumMacros([]), incomplete: false });
    const recipe = slot.recipe?.ingredients ? recipeMacros(slot.recipe.ingredients) : null;
    const base = recipe && slot.recipe ? perServing(recipe.total, slot.recipe.servings_base) : null;
    // Unavailable recipe, bad servings_base or an invalid planned servings count: nothing to add.
    if (!recipe || !base || !(slot.servings > 0)) {
      day.incomplete = true;
      continue;
    }
    if (recipe.incomplete) day.incomplete = true;
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
