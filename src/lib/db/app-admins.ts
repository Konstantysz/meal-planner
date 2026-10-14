import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether the signed-in user is an app admin (is_app_admin RPC, migration 0010). Used only to decide
 * which UI to show: RLS enforces the rule. Any error (signed out, RPC missing) counts as not an admin.
 */
export async function isAppAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_app_admin');
  return !error && data === true;
}
