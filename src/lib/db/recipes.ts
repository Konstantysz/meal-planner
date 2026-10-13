import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
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
  steps: Array<{ id: string; position: number; title: string | null; text: string }>;
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

/**
 * Copies a readable recipe with its ingredients and steps as the signed-in user's own recipe
 * (fork_recipe RPC, migration 0014) and returns the fork's id. The fork records the source in
 * `forked_from_id`; the source is never changed. A recipe the caller cannot read raises P0002.
 * The caller's existing fork of the same source is returned instead of a duplicate; a new fork's
 * name ends in " (kopia)". A source whose ingredients or steps the caller cannot read raises 22023.
 */
export async function forkRecipe(supabase: SupabaseClient, id: string): Promise<string> {
  const { data, error } = await supabase.rpc('fork_recipe', { p_recipe_id: id });
  if (error) throw error;
  return z.string().uuid().parse(data);
}

/**
 * Deletes a recipe and reports whether a row was deleted. RLS (rec_delete: author or app admin,
 * migration 0014) hides rows the caller may not delete, so a refused delete is `false`, not an error.
 * Plan slots that used the recipe keep their row with `recipe_id` set to null (on delete set null).
 */
export async function deleteRecipe(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from('recipes').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * The name of a recipe the caller can read, or null when it is missing, hidden by RLS or the
 * lookup fails. Used to link a fork to its original only when that link would open.
 */
export async function getRecipeName(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { data, error } = await supabase.from('recipes').select('name').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const parsed = z.object({ name: z.string() }).safeParse(data);
  return parsed.success ? parsed.data.name : null;
}
