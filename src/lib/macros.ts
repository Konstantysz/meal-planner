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

export interface RecipeIngredientMacroRow {
  amount: number | null;
  unit: string | null;
  optional: boolean;
  ingredients: IngredientMacroInput | null;
}

/**
 * Macros per serving of a stored recipe. Optional rows are left out; only `g` and `ml` amounts count
 * (1 ml = 1 g, as on the detail page before). Returns null when no row contributes (every ingredient
 * lacks macros or a weight), so the UI says „brak danych makro" instead of showing zeros, and when
 * `servings` is not positive.
 */
export function recipeMacrosPerServing(rows: RecipeIngredientMacroRow[], servings: number): Macros | null {
  const parts = rows.map((r) => {
    if (r.optional || !r.ingredients) return null;
    const grams = r.unit === 'g' || r.unit === 'ml' ? (r.amount ?? 0) : 0;
    return grams > 0 ? calculateIngredientMacros(r.ingredients, grams) : null;
  });
  if (parts.every((p) => p === null)) return null;
  return perServing(sumMacros(parts), servings);
}
