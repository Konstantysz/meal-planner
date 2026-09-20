import type { Macros } from './types';

export interface IngredientMacroInput {
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
}

export function calculateIngredientMacros(
  ingredient: IngredientMacroInput,
  grams: number
): Macros | null {
  const { kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g } = ingredient;
  if (kcal_per_100g === null && protein_per_100g === null && fat_per_100g === null && carbs_per_100g === null) {
    return null;
  }
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
    (acc, m) => m === null ? acc : {
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      fat: acc.fat + m.fat,
      carbs: acc.carbs + m.carbs,
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
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
