import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe, getRecipeName } from '@/lib/db/recipes';
import { isAppAdmin } from '@/lib/db/app-admins';
import { canEditRecipe } from '@/lib/recipe-access';
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = canEditRecipe(recipe, user?.id ?? null, await isAppAdmin(supabase));
  // Link a fork to its original only when the original is still readable (else the link would 404).
  const originalName = recipe.forked_from_id ? await getRecipeName(supabase, recipe.forked_from_id) : null;
  return <RecipeDetail recipe={recipe} canEdit={canEdit} originalName={originalName} />;
}
