import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getOrCreatePlan, getWeekPlan } from '@/lib/db/plans';
import { normalizeWeekStart } from '@/lib/week';

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const week = new URL(req.url).searchParams.get('week');
  // Any day of the week maps to its Monday; the DB rejects non-Monday plans (0005).
  const weekStart = week ? normalizeWeekStart(week) : null;
  if (!weekStart) return NextResponse.json({ error: 'week required (yyyy-MM-dd)' }, { status: 400 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { data: hh } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  if (!hh) return NextResponse.json({ error: 'no household' }, { status: 400 });
  const plan = await getOrCreatePlan(supabase, hh.household_id, weekStart);
  return NextResponse.json(await getWeekPlan(supabase, plan.id));
}
