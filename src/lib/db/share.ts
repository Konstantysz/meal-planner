import type { SupabaseClient } from '@supabase/supabase-js';
import { SharedPlanSchema, type SharedPlan } from '@/lib/schemas';

/** Read-only plan for a share token, or null if the token is unknown. Works for anonymous callers. */
export async function getSharedPlan(supabase: SupabaseClient, token: string): Promise<SharedPlan | null> {
  const { data, error } = await supabase.rpc('get_shared_plan', { p_token: token });
  if (error) throw error;
  if (data === null) return null;
  return SharedPlanSchema.parse(data);
}
