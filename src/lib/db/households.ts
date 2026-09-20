import type { SupabaseClient } from '@supabase/supabase-js';
import { generateShareToken } from '@/lib/share-token';

export async function createShareToken(supabase: SupabaseClient, planId: string, userId: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = generateShareToken();
    const { error } = await supabase.from('share_tokens').insert({ token, plan_id: planId, created_by: userId });
    if (!error) return token;
  }
  throw new Error('could not generate unique token');
}

// ponytail: brief's original inviteMember(email) inserted the raw email string into
// household_members.user_id (uuid FK to auth.users) — invalid UUID / FK violation for
// any real email. Resolving email -> user id requires a service-role admin client
// (supabase.auth.admin.*), which doesn't exist in this codebase. Pragmatic v1 fix:
// accept the already-resolved userId directly; caller is responsible for having it
// (e.g. the invitee is already a known member/user). Upgrade path: add a service-role
// client + admin.listUsers()/getUserByEmail lookup and restore an email-based API.
export async function inviteMember(supabase: SupabaseClient, householdId: string, userId: string) {
  const { data: memberRow } = await supabase.from('household_members')
    .select('household_id').eq('household_id', householdId).limit(1).single();
  if (!memberRow) throw new Error('not a member');
  const { error } = await supabase.from('household_members')
    .insert({ household_id: householdId, user_id: userId, role: 'member' });
  if (error) throw error;
}
