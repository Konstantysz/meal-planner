import type { SupabaseClient } from '@supabase/supabase-js';
import { RecipeInputSchema } from '@/lib/schemas';
import type { Recipe } from '@/lib/types';

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
  steps: Array<{ id: string; position: number; text: string }>;
}

export async function listRecipes(
  supabase: SupabaseClient,
  filters: { diet?: string[]; exclude?: string[] } = {},
): Promise<Recipe[]> {
  let q = supabase.from('recipes').select('*').order('created_at', { ascending: false });
  if (filters.diet?.length) q = q.contains('diet_tags', filters.diet);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data as Recipe[];
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
      steps:recipe_steps(id, position, text)
    `,
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as RecipeWithDetails;
}

/**
 * Saves recipe, ingredients and steps in one transaction (save_recipe RPC, migration 0006).
 * The author is always the signed-in user (auth.uid() in the database); RLS decides the household.
 */
export async function createRecipe(supabase: SupabaseClient, input: unknown, householdId: string): Promise<Recipe> {
  const parsed = RecipeInputSchema.parse(input);
  const { data, error } = await supabase.rpc('save_recipe', { p_household_id: householdId, p_recipe: parsed });
  if (error) throw error;
  return data as Recipe;
}
