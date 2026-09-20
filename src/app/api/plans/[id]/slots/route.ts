import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { upsertSlot } from '@/lib/db/plans';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const body = await req.json();
  try {
    return NextResponse.json(await upsertSlot(supabase, { ...body, plan_id: id }), { status: 200 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
