import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ingredient } from '@/lib/types';
import { IngredientInputSchema, type IngredientInput } from '@/lib/schemas';

export async function listIngredients(supabase: SupabaseClient): Promise<Ingredient[]> {
  const { data, error } = await supabase.from('ingredients').select('*').order('name');
  if (error) throw error;
  return data as Ingredient[];
}

export async function createIngredient(supabase: SupabaseClient, input: unknown): Promise<Ingredient> {
  const parsed = IngredientInputSchema.parse(input);
  const { data, error } = await supabase.from('ingredients').insert(parsed).select().single();
  if (error) throw error;
  return data as Ingredient;
}
