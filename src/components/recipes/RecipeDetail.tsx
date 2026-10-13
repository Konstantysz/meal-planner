import Link from 'next/link';
import { recipePerServing } from '@/lib/day-macros';
import type { RecipeWithDetails } from '@/lib/db/recipes';
import { Icon } from '@/components/ui';
import { MacroSummary } from './MacroSummary';
import { RecipeActions } from './RecipeActions';
import { RecipeCover } from './RecipeCover';
import { RecipePhotoBand } from './RecipePhoto';
import { RecipeIngredients } from './RecipeIngredients';
import { RecipeSteps } from './RecipeSteps';
import { RecipeTag } from './RecipeTag';
import { ALLERGEN_LABELS, DIET_LABELS } from './labels';

/**
 * Detail page body: cover band, facts, scaled ingredients beside collapsible steps.
 * `canEdit` (see `canEditRecipe`) picks in-place edit + delete or fork-to-edit; `originalName` is the
 * readable original's name for a fork (null when not a fork or the original is gone/hidden).
 */
export function RecipeDetail({
  recipe,
  canEdit,
  originalName = null,
}: {
  recipe: RecipeWithDetails;
  canEdit: boolean;
  originalName?: string | null;
}) {
  const per = recipePerServing(recipe.ingredients, recipe.servings_base);
  const ingredients = recipe.ingredients.slice().sort((a, b) => a.position - b.position);
  const steps = recipe.steps.slice().sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {recipe.image_url ? (
        <RecipePhotoBand src={recipe.image_url} sizes="(min-width: 1024px) 1024px, 100vw" />
      ) : (
        <RecipeCover variant="band" prepTimeMin={null} />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold leading-tight [hyphens:auto] [text-wrap:balance] lg:text-4xl">
          {recipe.name}
        </h1>
        <RecipeActions recipeId={recipe.id} canEdit={canEdit} />
      </div>
      {recipe.forked_from_id && originalName !== null && (
        <p className="text-sm text-muted">
          Kopia przepisu{' '}
          <Link href={`/recipes/${recipe.forked_from_id}`} className="underline underline-offset-2 hover:text-brand">
            „{originalName}”
          </Link>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <RecipeTag strong>
          <Icon name="servings" width={18} height={18} />
          {recipe.servings_base} porcji
        </RecipeTag>
        {recipe.prep_time_min != null && (
          <RecipeTag strong>
            <Icon name="time" width={18} height={18} />
            {recipe.prep_time_min} min
          </RecipeTag>
        )}
        {recipe.diet_tags.map((t) => (
          <RecipeTag key={t}>{DIET_LABELS[t] ?? t}</RecipeTag>
        ))}
        {recipe.allergens.map((a) => (
          <RecipeTag key={a}>Zawiera: {(ALLERGEN_LABELS[a] ?? a).toLowerCase()}</RecipeTag>
        ))}
      </div>
      <dl className="space-y-1 border-y border-line py-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">Na porcję</dt>
          <dd>
            <MacroSummary macros={per} />
          </dd>
        </div>
        {(recipe.source_url || recipe.source_author) && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">Autor</dt>
            <dd>
              {recipe.source_author}
              {recipe.source_url && recipe.source_author && ' · '}
              {recipe.source_url && (
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-brand"
                >
                  Źródło
                </a>
              )}
            </dd>
          </div>
        )}
        {recipe.image_url && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">Zdjęcie</dt>
            <dd>{new URL(recipe.image_url).hostname.replace(/^www\./, '')}</dd>
          </div>
        )}
      </dl>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <RecipeIngredients
          baseServings={recipe.servings_base}
          ingredients={ingredients.map((ri) => ({
            id: ri.id,
            amount: ri.amount,
            unit: ri.unit,
            raw_text: ri.raw_text,
            optional: ri.optional,
          }))}
        />
        <RecipeSteps steps={steps.map((s) => ({ id: s.id, title: s.title, text: s.text }))} />
      </div>
    </div>
  );
}
