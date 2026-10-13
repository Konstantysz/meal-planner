import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ZodError } from 'zod';
import { listRecipes, createRecipe } from '@/lib/db/recipes';
import { recipeFieldErrors } from '@/lib/recipe-errors';

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const url = new URL(req.url);
  const diet = url.searchParams.getAll('diet');
  const exclude = url.searchParams.getAll('exclude');
  try {
    return NextResponse.json(await listRecipes(supabase, { diet, exclude }));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { data: household } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  if (!household) return NextResponse.json({ error: 'no household' }, { status: 400 });
  try {
    const body = await req.json();
    const recipe = await createRecipe(supabase, body, household.household_id);
    return NextResponse.json(recipe, { status: 201 });
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json({ error: 'nieprawidłowe dane przepisu', fields: recipeFieldErrors(e) }, { status: 400 });
    // save_recipe raises 42501 when RLS blocks the insert.
    const code = (e as { code?: string } | null)?.code;
    if (code === '42501') return NextResponse.json({ error: 'brak dostępu do przepisu' }, { status: 403 });
    // Known client errors: bad text/uuid (22P02), unknown ingredient (23503), empty ingredients/steps (22023).
    if (code === '22P02' || code === '23503' || code === '22023')
      return NextResponse.json({ error: 'nieprawidłowe dane przepisu' }, { status: 400 });
    // Anything else is a server fault: log details, never echo them to the client.
    console.error('save_recipe failed', e);
    return NextResponse.json({ error: 'nie udało się zapisać przepisu' }, { status: 500 });
  }
}
