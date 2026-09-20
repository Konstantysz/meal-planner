import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createShareToken } from '@/lib/db/households';

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { plan_id } = await req.json();
  try {
    const token = await createShareToken(supabase, plan_id, user.id);
    return NextResponse.json({ token });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
