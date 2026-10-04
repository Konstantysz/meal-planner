import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSharedPlan } from '@/lib/db/share';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabase();
  const plan = await getSharedPlan(supabase, token);
  if (!plan) return NextResponse.json({ error: 'invalid token' }, { status: 404 });
  return NextResponse.json(plan);
}
