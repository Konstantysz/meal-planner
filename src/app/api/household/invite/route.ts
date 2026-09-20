import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { inviteMember } from '@/lib/db/households';

// ponytail: no email->user_id lookup available without a service-role admin client
// (see households.ts). This accepts an already-known user_id (uuid) instead of email.
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { household_id, user_id } = await req.json();
  if (!household_id || !user_id) {
    return NextResponse.json({ error: 'household_id and user_id required' }, { status: 400 });
  }
  try {
    await inviteMember(supabase, household_id, user_id);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
