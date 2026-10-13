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
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
