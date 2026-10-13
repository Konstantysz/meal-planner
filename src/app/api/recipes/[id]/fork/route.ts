import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { forkRecipe } from '@/lib/db/recipes';

/**
 * Forks a recipe the caller can read into their own recipe (fork_recipe RPC, migration 0014).
 * 201 with `{ id }` of the fork; the source recipe is never changed.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  try {
    return NextResponse.json({ id: await forkRecipe(supabase, id) }, { status: 201 });
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    // fork_recipe raises P0002 when the recipe does not exist or the caller cannot read it.
    if (code === 'P0002') return NextResponse.json({ error: 'przepis nie istnieje' }, { status: 404 });
    if (code === '22P02') return NextResponse.json({ error: 'nieprawidłowy identyfikator' }, { status: 400 });
    if (code === '42501') return NextResponse.json({ error: 'brak dostępu do przepisu' }, { status: 403 });
    console.error('fork_recipe failed', e);
    return NextResponse.json({ error: 'nie udało się skopiować przepisu' }, { status: 500 });
  }
}
