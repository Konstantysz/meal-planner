import type { RecipeWithDetails } from '@/lib/db/recipes';
import type { RecipeFormInitialValues } from './RecipeForm';

/** Maps a stored recipe (getRecipe) to the edit form's initial values, in position order. */
export function recipeToFormValues(recipe: RecipeWithDetails): RecipeFormInitialValues {
  return {
    name: recipe.name,
    servings_base: recipe.servings_base,
    prep_time_min: recipe.prep_time_min,
    source_url: recipe.source_url,
    source_author: recipe.source_author,
    visibility: recipe.visibility,
    diet_tags: recipe.diet_tags,
    allergens: recipe.allergens,
    ingredients: recipe.ingredients
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((ri) => ({
        ingredient_id: ri.ingredient_id,
        ingredient_name: ri.ingredients?.name ?? ri.raw_text,
        amount: ri.amount,
        unit: ri.unit,
        raw_text: ri.raw_text,
        position: ri.position,
        optional: ri.optional,
      })),
    steps: recipe.steps
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ title: s.title ?? '', text: s.text })),
  };
}
