import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { deleteSlot } from '@/lib/db/plans';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; slotId: string }> }) {
  const { slotId } = await params;
  const supabase = await createServerSupabase();
  try { await deleteSlot(supabase, slotId); return new NextResponse(null, { status: 204 }); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
