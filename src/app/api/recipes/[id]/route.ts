import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ZodError } from 'zod';
import { getRecipe, updateRecipe } from '@/lib/db/recipes';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  try {
    return NextResponse.json(await getRecipe(supabase, id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateRecipe(supabase, id, body));
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: String(e), issues: e.issues }, { status: 400 });
    // update_recipe raises 42501 when RLS blocks the update (or the recipe does not exist).
    const code = (e as { code?: string } | null)?.code;
    if (code === '42501') return NextResponse.json({ error: 'brak dostępu do przepisu' }, { status: 403 });
    return NextResponse.json({ error: String((e as { message?: string } | null)?.message ?? e) }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: String(error) }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
