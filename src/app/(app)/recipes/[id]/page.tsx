import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe, getRecipeCoverPosition } from '@/lib/db/recipes';
import { recipeMacrosPerServing } from '@/lib/macros';
import { safeHttpUrl } from '@/lib/safe-url';
import { ALLERGEN_LABELS, DIET_LABELS } from '@/lib/recipe-labels';
import { MacroSummary } from '@/components/recipes/MacroSummary';
import { RecipeActions } from '@/components/recipes/RecipeActions';
import { ScalableIngredients } from '@/components/recipes/ScalableIngredients';
import { StepCards } from '@/components/recipes/StepCards';
import { Icon, Tag } from '@/components/ui';
import { slotClass } from '@/components/plan/slot-colors';

const CHIP = 'inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-3 text-base font-medium';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  let recipe;
  try {
    recipe = await getRecipe(supabase, id);
  } catch {
    notFound();
  }

  const sourceUrl = safeHttpUrl(recipe.source_url);
  const per = recipeMacrosPerServing(recipe.ingredients, recipe.servings_base);
  const cover = await getRecipeCoverPosition(supabase, recipe.id);

  return (
    <article className="pb-8">
      {/* Colour band; a photo would replace it here (design brief, "Recipe cover and photos"). */}
      <div aria-hidden="true" className={`h-20 lg:h-28 ${cover === null ? 'bg-hover' : slotClass(cover, true)}`} />
      <div className="mx-auto max-w-5xl space-y-6 p-4 lg:px-8 lg:py-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 font-display text-[26px] leading-tight font-extrabold tracking-tight break-words hyphens-auto text-balance lg:text-4xl">
              {recipe.name}
            </h1>
            <RecipeActions recipeId={recipe.id} />
          </div>
          <ul className="flex flex-wrap gap-2">
            <li className={CHIP}>
              <Icon name="servings" width={20} height={20} className="text-faint" />
              {recipe.servings_base} porcji
            </li>
            {recipe.prep_time_min != null && (
              <li className={CHIP}>
                <Icon name="time" width={20} height={20} className="text-faint" />
                {recipe.prep_time_min} min
              </li>
            )}
          </ul>
          {(recipe.diet_tags.length > 0 || recipe.allergens.length > 0) && (
            <ul className="flex flex-wrap gap-1">
              {recipe.diet_tags.map((t) => (
                <li key={t}>
                  <Tag>{DIET_LABELS[t] ?? t}</Tag>
                </li>
              ))}
              {recipe.allergens.map((a) => (
                <li key={a}>
                  <Tag>zawiera: {ALLERGEN_LABELS[a] ?? a}</Tag>
                </li>
              ))}
            </ul>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-line py-3 text-sm">
            <dt className="text-muted">Na porcję</dt>
            <dd>
              <MacroSummary macros={per} />
            </dd>
          </dl>
          {(sourceUrl || recipe.source_author) && (
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 underline underline-offset-2 hover:text-brand lg:min-h-0"
                >
                  Źródło
                  <Icon name="link" width={16} height={16} />
                </a>
              )}
              {sourceUrl && recipe.source_author && (
                <span aria-hidden="true" className="text-muted">
                  ·
                </span>
              )}
              {recipe.source_author && (
                <span>
                  {!sourceUrl && <span className="text-muted">Źródło: </span>}
                  {recipe.source_author}
                </span>
              )}
            </p>
          )}
        </header>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <ScalableIngredients
            baseServings={recipe.servings_base}
            lines={recipe.ingredients
              .slice()
              .sort((a, b) => a.position - b.position)
              .map(({ id, amount, unit, raw_text, optional }) => ({ id, amount, unit, raw_text, optional }))}
          />
          <StepCards
            steps={recipe.steps
              .slice()
              .sort((a, b) => a.position - b.position)
              .map(({ id, title, text }) => ({ id, title, text }))}
          />
        </div>
      </div>
    </article>
  );
}
