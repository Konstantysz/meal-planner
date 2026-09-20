import type { ShoppingItem, IngredientCategory } from './types';

export interface PlannedIngredient {
  ingredient_id: string;
  ingredient_name: string;
  category: IngredientCategory;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  has_macros: boolean;
}

export interface PlannedRecipe {
  recipe_id: string;
  servings: number;
  base_servings: number;
  ingredients: PlannedIngredient[];
}

export function aggregateShoppingList(planned: PlannedRecipe[]): ShoppingItem[] {
  const groups = new Map<string, ShoppingItem>();

  for (const recipe of planned) {
    const factor = recipe.base_servings > 0 ? recipe.servings / recipe.base_servings : 1;
    for (const ing of recipe.ingredients) {
      const key = `${ing.ingredient_id}::${ing.unit ?? 'none'}`;
      const scaled = ing.amount !== null ? ing.amount * factor : null;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          ingredient_id: ing.ingredient_id,
          ingredient_name: ing.ingredient_name,
          category: ing.category,
          unit: ing.unit,
          total_amount: scaled,
          raw_amounts: [ing.raw_text],
          have_it: false,
          incomplete: !ing.has_macros,
        });
      } else {
        if (scaled !== null && existing.total_amount !== null) existing.total_amount += scaled;
        else if (scaled !== null) existing.total_amount = scaled;
        existing.raw_amounts.push(ing.raw_text);
        existing.incomplete = existing.incomplete || !ing.has_macros;
      }
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.ingredient_name.localeCompare(b.ingredient_name);
  });
}
