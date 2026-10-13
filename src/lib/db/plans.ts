import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanSlotInputSchema, PlanSlotPatchSchema } from '@/lib/schemas';
import type { PlannedRecipeIngredient } from '@/lib/day-macros';
import type { Plan, PlanSlot } from '@/lib/types';

export interface WeekPlan extends Plan {
  slots: Array<PlanSlot & { recipe: { id: string; name: string; servings_base: number } | null }>;
}

export interface PlanWithSlots extends Plan {
  slots: Array<
    PlanSlot & {
      recipe: { id: string; name: string; servings_base: number; ingredients: PlannedRecipeIngredient[] } | null;
    }
  >;
}

export async function getOrCreatePlan(supabase: SupabaseClient, householdId: string, weekStart: string): Promise<Plan> {
  const { data: existing } = await supabase
    .from('plans')
    .select('*')
    .eq('household_id', householdId)
    .eq('week_start_date', weekStart)
    .maybeSingle();
  if (existing) return existing as Plan;
  const { data, error } = await supabase
    .from('plans')
    .insert({ household_id: householdId, week_start_date: weekStart })
    .select()
    .single();
  if (error) throw error;
  return data as Plan;
}

/** Plan with slots and bare recipe refs; for callers that don't need macros (shopping). */
export async function getWeekPlan(supabase: SupabaseClient, planId: string): Promise<WeekPlan> {
  const { data, error } = await supabase
    .from('plans')
    .select('*, slots:plan_slots(*, recipe:recipes(id, name, servings_base))')
    .eq('id', planId)
    .single();
  if (error) throw error;
  return data as unknown as WeekPlan;
}

/** Like `getWeekPlan` plus per-recipe ingredient macro columns, for the plan UI's day totals. */
export async function getWeekPlanWithMacros(supabase: SupabaseClient, planId: string): Promise<PlanWithSlots> {
  const { data, error } = await supabase
    .from('plans')
    .select(
      '*, slots:plan_slots(*, recipe:recipes(id, name, servings_base, ingredients:recipe_ingredients(amount, unit, optional, ingredients(kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g))))',
    )
    .eq('id', planId)
    .single();
  if (error) throw error;
  type RawSlot = Omit<WeekPlan['slots'][number], 'recipe'> & {
    recipe: { id: string; name: string; servings_base: number; ingredients?: unknown } | null;
  };
  const plan = data as unknown as Omit<WeekPlan, 'slots'> & { slots: RawSlot[] };
  return {
    ...plan,
    slots: plan.slots.map((s) => ({
      ...s,
      recipe: s.recipe
        ? { ...s.recipe, ingredients: Array.isArray(s.recipe.ingredients) ? s.recipe.ingredients : [] }
        : null,
    })),
  } as PlanWithSlots;
}

export async function upsertSlot(supabase: SupabaseClient, input: unknown): Promise<PlanSlot> {
  const parsed = PlanSlotInputSchema.parse(input);
  const { data, error } = await supabase
    .from('plan_slots')
    .upsert(parsed, { onConflict: 'plan_id,date,position' })
    .select()
    .single();
  if (error) throw error;
  return data as PlanSlot;
}

/** Thrown by `updateSlot` when the target (date, position) is already taken. */
export class SlotOccupiedError extends Error {}
/** Thrown by `updateSlot` when no slot with that id exists in the plan (or RLS hides it). */
export class SlotNotFoundError extends Error {}

/** Moves a slot and/or changes its servings in one UPDATE; `unique (plan_id, date, position)` rejects an occupied target. */
export async function updateSlot(
  supabase: SupabaseClient,
  planId: string,
  slotId: string,
  input: unknown,
): Promise<PlanSlot> {
  const patch = PlanSlotPatchSchema.parse(input);
  const { data, error } = await supabase
    .from('plan_slots')
    .update(patch)
    .eq('id', slotId)
    .eq('plan_id', planId)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === '23505') throw new SlotOccupiedError('slot occupied');
    throw error;
  }
  if (!data) throw new SlotNotFoundError('slot not found');
  return data as PlanSlot;
}

export async function deleteSlot(supabase: SupabaseClient, slotId: string): Promise<void> {
  const { error } = await supabase.from('plan_slots').delete().eq('id', slotId);
  if (error) throw error;
}
