import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';
import { RecipeForm, type RecipeFormInitialValues } from '@/components/recipes/RecipeForm';

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  let recipe;
  try {
    recipe = await getRecipe(supabase, id);
  } catch {
    notFound();
  }

  const initialValues: RecipeFormInitialValues = {
    name: recipe.name,
    servings_base: recipe.servings_base,
    prep_time_min: recipe.prep_time_min,
    diet_tags: recipe.diet_tags,
    allergens: recipe.allergens,
    ingredients: recipe.ingredients
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((ri) => ({
        ingredient_id: ri.ingredient_id,
        ingredient_name: ri.ingredients?.name ?? ri.raw_text,
        amount: ri.amount,
        unit: ri.unit,
        raw_text: ri.raw_text,
        position: ri.position,
      })),
    steps: recipe.steps
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((s) => s.text),
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Edycja przepisu</h1>
      <p className="text-sm text-gray-500 mb-4">
        Podgląd bieżących danych. Zapis zmian nie jest jeszcze wspierany w tym API.
      </p>
      <RecipeForm initialValues={initialValues} readOnly />
    </div>
  );
}
