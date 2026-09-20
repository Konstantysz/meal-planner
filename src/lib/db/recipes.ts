import type { SupabaseClient } from '@supabase/supabase-js';
import { RecipeInputSchema } from '@/lib/schemas';
import type { Recipe } from '@/lib/types';

export interface RecipeWithDetails extends Recipe {
  ingredients: Array<{
    id: string; ingredient_id: string; amount: number | null; unit: string | null;
    raw_text: string; position: number;
    ingredients: { id: string; name: string; category: string;
      kcal_per_100g: number | null; protein_per_100g: number | null;
      fat_per_100g: number | null; carbs_per_100g: number | null } | null;
  }>;
  steps: Array<{ id: string; position: number; text: string }>;
}

export async function listRecipes(
  supabase: SupabaseClient,
  filters: { diet?: string[]; exclude?: string[] } = {}
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
    .select(`
      *,
      ingredients:recipe_ingredients(*, ingredients(id, name, category, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g)),
      steps:recipe_steps(id, position, text)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as RecipeWithDetails;
}

export async function createRecipe(
  supabase: SupabaseClient,
  input: unknown,
  authorId: string,
  householdId: string
): Promise<Recipe> {
  const parsed = RecipeInputSchema.parse(input);
  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      author_id: authorId,
      name: parsed.name,
      servings_base: parsed.servings_base,
      prep_time_min: parsed.prep_time_min,
      source_url: parsed.source_url,
      visibility: parsed.visibility,
      diet_tags: parsed.diet_tags,
      allergens: parsed.allergens,
    })
    .select()
    .single();
  if (error) throw error;

  const recipeId = (recipe as Recipe).id;
  const { error: ingErr } = await supabase.from('recipe_ingredients').insert(
    parsed.ingredients.map((i) => ({ ...i, recipe_id: recipeId }))
  );
  if (ingErr) throw ingErr;
  const { error: stepErr } = await supabase.from('recipe_steps').insert(
    parsed.steps.map((s) => ({ ...s, recipe_id: recipeId }))
  );
  if (stepErr) throw stepErr;
  return recipe as Recipe;
}
