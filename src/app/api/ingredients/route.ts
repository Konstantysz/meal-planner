import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { listIngredients, createIngredient } from '@/lib/db/ingredients';

export async function GET() {
  const supabase = await createServerSupabase();
  try { return NextResponse.json(await listIngredients(supabase)); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    return NextResponse.json(await createIngredient(supabase, body), { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
