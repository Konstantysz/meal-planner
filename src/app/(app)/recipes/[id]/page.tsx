import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';
import { RecipeDetail } from '@/components/recipes/RecipeDetail';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  let recipe;
  try {
    recipe = await getRecipe(supabase, id);
  } catch {
    notFound();
  }
  return <RecipeDetail recipe={recipe} />;
}
