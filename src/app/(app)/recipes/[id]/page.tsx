import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';
import { calculateIngredientMacros, sumMacros, perServing } from '@/lib/macros';
import { formatAmount } from '@/lib/scaling';
import { MacroSummary } from '@/components/recipes/MacroSummary';
import { RecipeActions } from '@/components/recipes/RecipeActions';
import { RecipePhoto } from '@/components/recipes/RecipePhoto';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  let recipe;
  try {
    recipe = await getRecipe(supabase, id);
  } catch {
    notFound();
  }

  const total = sumMacros(
    recipe.ingredients.map((ri) => {
      if (!ri.ingredients || ri.optional) return null;
      const grams = ri.unit === 'g' || ri.unit === 'ml' ? (ri.amount ?? 0) : 0;
      return calculateIngredientMacros(ri.ingredients, grams);
    }),
  );
  const per = perServing(total, recipe.servings_base);

  return (
    <div className="p-4 space-y-4">
      {recipe.image_url && (
        <div className="relative aspect-video overflow-hidden rounded-block bg-hover">
          <RecipePhoto src={recipe.image_url} sizes="(min-width: 1024px) 768px, 100vw" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{recipe.name}</h1>
        <RecipeActions recipeId={recipe.id} />
      </div>
      <ul className="flex flex-wrap gap-2 text-sm">
        <li className="rounded-control border border-line px-3 py-1 text-ink">{recipe.servings_base} porcji</li>
        {recipe.prep_time_min != null && (
          <li className="rounded-control border border-line px-3 py-1 text-ink">{recipe.prep_time_min} min</li>
        )}
      </ul>
      <div className="bg-green-50 rounded p-3">
        <div className="text-xs text-gray-600 mb-1">Makro per porcja:</div>
        <MacroSummary macros={per} />
      </div>
      {recipe.source_url && (
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 text-sm underline"
        >
          Źródło
        </a>
      )}
      {recipe.image_url && recipe.source_url && (
        <p className="text-xs text-muted">Zdjęcie: {new URL(recipe.source_url).hostname.replace(/^www\./, '')}</p>
      )}
      <section>
        <h2 className="font-semibold text-lg">Składniki</h2>
        <ul className="list-disc pl-6">
          {recipe.ingredients
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((ri) => (
              <li key={ri.id}>
                {ri.amount != null ? `${formatAmount(ri.amount, ri.unit)} ` : ''}
                {ri.raw_text}
                {ri.optional && <span className="opacity-60"> (opcjonalnie)</span>}
              </li>
            ))}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-lg">Kroki</h2>
        <ol className="list-decimal pl-6 space-y-1">
          {recipe.steps
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((s) => (
              <li key={s.id}>{s.text}</li>
            ))}
        </ol>
      </section>
    </div>
  );
}
