import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanSlotInputSchema, PlanSlotPatchSchema } from '@/lib/schemas';
import { weekEndOf } from '@/lib/week';
import type { Plan, PlanSlot } from '@/lib/types';

export interface PlanWithSlots extends Plan {
  slots: Array<
    PlanSlot & {
      recipe: { id: string; name: string; servings_base: number } | null;
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

export async function getWeekPlan(supabase: SupabaseClient, planId: string): Promise<PlanWithSlots> {
  const { data, error } = await supabase
    .from('plans')
    .select('*, slots:plan_slots(*, recipe:recipes(id, name, servings_base))')
    .eq('id', planId)
    .single();
  if (error) throw error;
  return data as unknown as PlanWithSlots;
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

/** Thrown by `updateSlot` when the target date lies outside the plan's Monday..Sunday window. */
export class SlotDateOutOfWeekError extends Error {}

/** Moves a slot and/or changes its servings in one UPDATE; `unique (plan_id, date, position)` rejects an occupied target. */
export async function updateSlot(
  supabase: SupabaseClient,
  planId: string,
  slotId: string,
  input: unknown,
): Promise<PlanSlot> {
  const patch = PlanSlotPatchSchema.parse(input);
  if (patch.date) {
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('week_start_date')
      .eq('id', planId)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) throw new SlotNotFoundError('slot not found');
    const start = (plan as { week_start_date: string }).week_start_date;
    if (patch.date < start || patch.date > weekEndOf(start)) {
      throw new SlotDateOutOfWeekError('date outside the plan week');
    }
  }
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
