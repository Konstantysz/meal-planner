import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  try { return NextResponse.json(await getRecipe(supabase, id)); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 404 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: String(error) }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
