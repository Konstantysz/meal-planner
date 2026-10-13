import type { SupabaseClient } from '@supabase/supabase-js';
import { RecipeInputSchema } from '@/lib/schemas';
import { recipePerServing, type PlannedRecipeIngredient } from '@/lib/day-macros';
import type { Macros, Recipe } from '@/lib/types';

export interface RecipeWithDetails extends Recipe {
  ingredients: Array<{
    id: string;
    ingredient_id: string;
    amount: number | null;
    unit: string | null;
    raw_text: string;
    position: number;
    optional: boolean;
    ingredients: {
      id: string;
      name: string;
      category: string;
      kcal_per_100g: number | null;
      protein_per_100g: number | null;
      fat_per_100g: number | null;
      carbs_per_100g: number | null;
    } | null;
  }>;
  steps: Array<{ id: string; position: number; title: string | null; text: string }>;
}

/** A recipe on the list: the row plus its per-serving macros (null when data is missing). */
export interface RecipeListItem extends Recipe {
  macros_per_serving: Macros | null;
}

/** One recipe row with the ingredient columns `recipePerServing` needs, as `listRecipes` selects it. */
export type RecipeListRow = Recipe & { ingredients: PlannedRecipeIngredient[] | null };

/** Replaces the joined ingredient rows with the recipe's per-serving macros. */
export function toListItem({ ingredients, ...recipe }: RecipeListRow): RecipeListItem {
  return { ...recipe, macros_per_serving: ingredients ? recipePerServing(ingredients, recipe.servings_base) : null };
}

export async function listRecipes(
  supabase: SupabaseClient,
  filters: { diet?: string[]; exclude?: string[] } = {},
): Promise<RecipeListItem[]> {
  let q = supabase
    .from('recipes')
    .select(
      '*, ingredients:recipe_ingredients(amount, unit, optional, ingredients(kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g))',
    )
    .order('created_at', { ascending: false });
  if (filters.diet?.length) q = q.contains('diet_tags', filters.diet);
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data as unknown as RecipeListRow[]).map(toListItem);
  if (filters.exclude?.length) {
    rows = rows.filter((r) => !r.allergens.some((a) => filters.exclude!.includes(a)));
  }
  return rows;
}

export async function getRecipe(supabase: SupabaseClient, id: string): Promise<RecipeWithDetails> {
  const { data, error } = await supabase
    .from('recipes')
    .select(
      `
      *,
      ingredients:recipe_ingredients(*, ingredients(id, name, category, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g)),
      steps:recipe_steps(id, position, title, text)
    `,
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as RecipeWithDetails;
}

/**
 * Saves recipe, ingredients and steps in one transaction (save_recipe RPC, migration 0006;
 * source_author and step titles since 0008).
 * The author is always the signed-in user (auth.uid() in the database); RLS decides the household.
 */
export async function createRecipe(supabase: SupabaseClient, input: unknown, householdId: string): Promise<Recipe> {
  const parsed = RecipeInputSchema.parse(input);
  const { data, error } = await supabase.rpc('save_recipe', { p_household_id: householdId, p_recipe: parsed });
  if (error) throw error;
  return data as Recipe;
}

/**
 * Edits a saved recipe in one transaction (update_recipe RPC, migration 0009): updates the recipe's
 * own columns and replaces its ingredients and steps. `author_id` and `household_id` never change.
 * RLS decides who may edit; when it blocks the update the RPC raises 42501 (`insufficient_privilege`)
 * instead of silently updating nothing, and that PostgREST error is thrown as is.
 */
export async function updateRecipe(supabase: SupabaseClient, id: string, input: unknown): Promise<Recipe> {
  const parsed = RecipeInputSchema.parse(input);
  const { data, error } = await supabase.rpc('update_recipe', { p_recipe_id: id, p_recipe: parsed });
  if (error) throw error;
  return data as Recipe;
}
