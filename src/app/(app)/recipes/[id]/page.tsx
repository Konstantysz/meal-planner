import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';
import { calculateIngredientMacros, sumMacros, perServing } from '@/lib/macros';
import { MacroSummary } from '@/components/recipes/MacroSummary';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  let recipe;
  try { recipe = await getRecipe(supabase, id); }
  catch { notFound(); }

  const total = sumMacros(recipe.ingredients.map((ri) => {
    if (!ri.ingredients) return null;
    const grams = ri.unit === 'g' || ri.unit === 'ml' ? (ri.amount ?? 0) : 0;
    return calculateIngredientMacros(ri.ingredients, grams);
  }));
  const per = perServing(total, recipe.servings_base);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">{recipe.name}</h1>
      <p className="text-sm text-gray-600">
        {recipe.servings_base} porcji
        {recipe.prep_time_min != null && ` · ${recipe.prep_time_min} min`}
      </p>
      <div className="bg-green-50 rounded p-3">
        <div className="text-xs text-gray-600 mb-1">Makro per porcja:</div>
        <MacroSummary macros={per} />
      </div>
      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">
          Źródło
        </a>
      )}
      <section>
        <h2 className="font-semibold text-lg">Składniki</h2>
        <ul className="list-disc pl-6">
          {recipe.ingredients
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((ri) => <li key={ri.id}>{ri.raw_text}</li>)}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-lg">Kroki</h2>
        <ol className="list-decimal pl-6 space-y-1">
          {recipe.steps
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((s) => <li key={s.id}>{s.text}</li>)}
        </ol>
      </section>
    </div>
  );
}
