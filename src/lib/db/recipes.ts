import { format, subDays } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RecipeInputSchema } from '@/lib/schemas';
import { coverPosition } from '@/lib/recipe-cover';
import { recipeMacrosPerServing, type RecipeIngredientMacroRow } from '@/lib/macros';
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

/** A list row: the recipe plus what a card shows that is not stored on it. */
export interface RecipeListItem extends Recipe {
  /** Per serving, computed from the ingredients; null when there is no macro data. */
  macros_per_serving: Macros | null;
  /** Slot position the cover takes its colour from; null when the recipe was never planned. */
  cover_position: number | null;
}

/** How far back slot usage counts towards a cover colour; bounds the read (no migration needed). */
const COVER_WINDOW_DAYS = 180;
/** Stay under PostgREST's default max-rows (1000) so truncation is explicit and drops the oldest slots. */
const COVER_SLOT_LIMIT = 1000;

type PlannedSlot = { recipe_id: string; position: number; date: string };

/**
 * Recent slot usage of recipes in the household's plans (RLS scopes it), newest first. Read errors are
 * thrown, not hidden. Only the last `COVER_WINDOW_DAYS` days count, so the colour follows current habits.
 */
async function plannedSlots(supabase: SupabaseClient, recipeId?: string): Promise<PlannedSlot[]> {
  const since = format(subDays(new Date(), COVER_WINDOW_DAYS), 'yyyy-MM-dd');
  let q = supabase
    .from('plan_slots')
    .select('recipe_id, position, date')
    .not('recipe_id', 'is', null)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(COVER_SLOT_LIMIT);
  if (recipeId) q = q.eq('recipe_id', recipeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PlannedSlot[];
}

export async function listRecipes(
  supabase: SupabaseClient,
  filters: { diet?: string[]; exclude?: string[] } = {},
): Promise<RecipeListItem[]> {
  let q = supabase
    .from('recipes')
    .select(
      '*, recipe_ingredients(amount, unit, optional, ingredients(kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g))',
    )
    .order('created_at', { ascending: false });
  if (filters.diet?.length) q = q.contains('diet_tags', filters.diet);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data as Array<Recipe & { recipe_ingredients: RecipeIngredientMacroRow[] | null }>;
  if (filters.exclude?.length) {
    rows = rows.filter((r) => !r.allergens.some((a) => filters.exclude!.includes(a)));
  }
  const byRecipe = new Map<string, PlannedSlot[]>();
  for (const s of await plannedSlots(supabase)) {
    const list = byRecipe.get(s.recipe_id);
    if (list) list.push(s);
    else byRecipe.set(s.recipe_id, [s]);
  }
  return rows.map(({ recipe_ingredients, ...recipe }) => ({
    ...recipe,
    macros_per_serving: recipeMacrosPerServing(recipe_ingredients ?? [], recipe.servings_base),
    cover_position: coverPosition(byRecipe.get(recipe.id) ?? []),
  }));
}

/** Cover colour position of one recipe (see `coverPosition`). */
export async function getRecipeCoverPosition(supabase: SupabaseClient, recipeId: string): Promise<number | null> {
  return coverPosition(await plannedSlots(supabase, recipeId));
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
