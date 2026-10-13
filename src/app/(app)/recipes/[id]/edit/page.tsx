import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';
import { RecipeForm } from '@/components/recipes/RecipeForm';
import { recipeToFormValues } from '@/components/recipes/form-values';

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  let recipe;
  try {
    recipe = await getRecipe(supabase, id);
  } catch {
    notFound();
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Edycja przepisu</h1>
      <RecipeForm initialValues={recipeToFormValues(recipe)} recipeId={id} />
    </div>
  );
}
