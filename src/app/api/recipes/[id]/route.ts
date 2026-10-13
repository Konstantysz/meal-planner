import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ZodError } from 'zod';
import { deleteRecipe, getRecipe, updateRecipe } from '@/lib/db/recipes';

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
    if (e instanceof ZodError) return NextResponse.json({ error: String(e) }, { status: 400 });
    // update_recipe raises 42501 when RLS blocks the update (or the recipe does not exist).
    const code = (e as { code?: string } | null)?.code;
    if (code === '42501') return NextResponse.json({ error: 'brak dostępu do przepisu' }, { status: 403 });
    // Known client errors: bad text/uuid (22P02), unknown ingredient (23503), empty ingredients/steps (22023).
    if (code === '22P02' || code === '23503' || code === '22023')
      return NextResponse.json({ error: 'nieprawidłowe dane przepisu' }, { status: 400 });
    // Anything else is a server fault: log details, never echo them to the client.
    console.error('update_recipe failed', e);
    return NextResponse.json({ error: 'nie udało się zapisać przepisu' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  let deleted: boolean;
  try {
    deleted = await deleteRecipe(supabase, id);
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === '22P02') return NextResponse.json({ error: 'nieprawidłowy identyfikator' }, { status: 400 });
    console.error('delete recipe failed', e);
    return NextResponse.json({ error: 'nie udało się usunąć przepisu' }, { status: 500 });
  }
  // RLS (rec_delete: author or app admin, migration 0014) hides rows the caller may not delete, so
  // 0 rows is a refusal (or an unknown id), never a silent success.
  if (!deleted) return NextResponse.json({ error: 'brak dostępu do przepisu' }, { status: 403 });
  return new NextResponse(null, { status: 204 });
}
