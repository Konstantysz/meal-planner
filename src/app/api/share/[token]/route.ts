import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getWeekPlan } from '@/lib/db/plans';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabase();
  const { data: st } = await supabase.from('share_tokens').select('plan_id').eq('token', token).single();
  if (!st) return NextResponse.json({ error: 'invalid token' }, { status: 404 });
  const plan = await getWeekPlan(supabase, st.plan_id);
  return NextResponse.json(plan);
}
