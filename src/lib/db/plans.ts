import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanSlotInputSchema } from '@/lib/schemas';
import type { Plan, PlanSlot } from '@/lib/types';

export interface PlanWithSlots extends Plan {
  slots: Array<PlanSlot & {
    recipe: { id: string; name: string; servings_base: number } | null;
  }>;
}

export async function getOrCreatePlan(
  supabase: SupabaseClient, householdId: string, weekStart: string
): Promise<Plan> {
  const { data: existing } = await supabase
    .from('plans').select('*')
    .eq('household_id', householdId).eq('week_start_date', weekStart).maybeSingle();
  if (existing) return existing as Plan;
  const { data, error } = await supabase
    .from('plans').insert({ household_id: householdId, week_start_date: weekStart })
    .select().single();
  if (error) throw error;
  return data as Plan;
}

export async function getWeekPlan(supabase: SupabaseClient, planId: string): Promise<PlanWithSlots> {
  const { data, error } = await supabase
    .from('plans')
    .select('*, slots:plan_slots(*, recipe:recipes(id, name, servings_base))')
    .eq('id', planId).single();
  if (error) throw error;
  return data as unknown as PlanWithSlots;
}

export async function upsertSlot(supabase: SupabaseClient, input: unknown): Promise<PlanSlot> {
  const parsed = PlanSlotInputSchema.parse(input);
  const { data, error } = await supabase
    .from('plan_slots')
    .upsert(parsed, { onConflict: 'plan_id,date,position' })
    .select().single();
  if (error) throw error;
  return data as PlanSlot;
}

export async function deleteSlot(supabase: SupabaseClient, slotId: string): Promise<void> {
  const { error } = await supabase.from('plan_slots').delete().eq('id', slotId);
  if (error) throw error;
}
