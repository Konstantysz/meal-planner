import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { deleteSlot, SlotDateOutOfWeekError, SlotNotFoundError, SlotOccupiedError, updateSlot } from '@/lib/db/plans';

type Ctx = { params: Promise<{ id: string; slotId: string }> };

/** Move a slot (date, position) and/or change its servings in one request. RLS is the authorization boundary. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, slotId } = await params;
  const body: unknown = await req.json().catch(() => null);
  const supabase = await createServerSupabase();
  try {
    return NextResponse.json(await updateSlot(supabase, id, slotId, body));
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof SlotDateOutOfWeekError)
      return NextResponse.json({ error: 'date outside the plan week' }, { status: 400 });
    if (e instanceof SlotOccupiedError) return NextResponse.json({ error: 'slot occupied' }, { status: 409 });
    if (e instanceof SlotNotFoundError) return NextResponse.json({ error: 'slot not found' }, { status: 404 });
    console.error('PATCH slot failed', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { slotId } = await params;
  const supabase = await createServerSupabase();
  try {
    await deleteSlot(supabase, slotId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
