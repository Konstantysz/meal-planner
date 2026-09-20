import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { listIngredients, createIngredient } from '@/lib/db/ingredients';

export async function GET() {
  const supabase = await createServerSupabase();
  try {
    return NextResponse.json(await listIngredients(supabase));
  } catch (e) {
    console.error('Failed to list ingredients:', e);
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    return NextResponse.json(await createIngredient(supabase, body), { status: 201 });
  } catch (e) {
    console.error('Failed to create ingredient:', e);
    return NextResponse.json({ error: 'Failed to create ingredient' }, { status: 400 });
  }
}
