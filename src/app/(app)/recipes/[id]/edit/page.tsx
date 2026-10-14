import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';
import { isAppAdmin } from '@/lib/db/app-admins';
import { canEditRecipe } from '@/lib/recipe-access';
import { RecipeForm } from '@/components/recipes/RecipeForm';
import { ForkEditButton } from '@/components/recipes/ForkEditButton';
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = canEditRecipe(recipe, user?.id ?? null, await isAppAdmin(supabase));

  // Someone else's recipe: never edited in place. Forking is a write, so it waits for a click
  // instead of happening on page load.
  if (!canEdit) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-2xl font-bold">Edycja przepisu</h1>
        <p>
          „{recipe.name}” to przepis innego domownika. Zmiany zapiszesz we własnej kopii, a oryginał zostanie bez zmian.
        </p>
        <div className="flex items-center gap-3">
          <ForkEditButton recipeId={id} label="Utwórz kopię i edytuj" primary />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Edycja przepisu</h1>
      <RecipeForm initialValues={recipeToFormValues(recipe)} recipeId={id} />
    </div>
  );
}
