import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getOrCreatePlan, getWeekPlan } from '@/lib/db/plans';
import { getRecipe } from '@/lib/db/recipes';
import { aggregateShoppingList, type PlannedRecipe } from '@/lib/shopping-list';
import type { IngredientCategory } from '@/lib/types';

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const week = new URL(req.url).searchParams.get('week');
  if (!week) return NextResponse.json({ error: 'week required' }, { status: 400 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { data: hh } = await supabase.from('household_members')
    .select('household_id').eq('user_id', user.id).limit(1).single();
  if (!hh) return NextResponse.json({ error: 'no household' }, { status: 400 });

  const plan = await getOrCreatePlan(supabase, hh.household_id, week);
  const full = await getWeekPlan(supabase, plan.id);

  const planned: PlannedRecipe[] = [];
  for (const slot of full.slots) {
    if (!slot.recipe_id) continue;
    const r = await getRecipe(supabase, slot.recipe_id);
    planned.push({
      recipe_id: r.id,
      servings: slot.servings,
      base_servings: r.servings_base,
      ingredients: r.ingredients.map((ri) => ({
        ingredient_id: ri.ingredient_id,
        ingredient_name: ri.ingredients?.name ?? ri.raw_text,
        category: (ri.ingredients?.category ?? 'inne') as IngredientCategory,
        amount: ri.amount,
        unit: ri.unit,
        raw_text: ri.raw_text,
        has_macros: !!(ri.ingredients?.kcal_per_100g != null || ri.ingredients?.protein_per_100g != null),
      })),
    });
  }
  return NextResponse.json(aggregateShoppingList(planned));
}
