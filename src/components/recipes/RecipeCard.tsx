import Link from 'next/link';
import type { RecipeListItem } from '@/lib/db/recipes';
import { MacroSummary } from './MacroSummary';
import { RecipeCover } from './RecipeCover';
import { RecipeTag } from './RecipeTag';
import { ALLERGEN_LABELS, DIET_LABELS } from './labels';

/** List card: cover (3:4, photo-ready) over a hairline-separated block of facts. */
export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  return (
    <Link href={`/recipes/${recipe.id}`} className="flex flex-col gap-2">
      {/* Photo layer (#43): once RecipePhoto exists, pass <RecipePhoto src={recipe.image_url} scrim /> as `photo`. */}
      <RecipeCover name={recipe.name} prepTimeMin={recipe.prep_time_min} />
      <div className="space-y-1.5 border-t border-line pt-2">
        {recipe.source_author && <p className="truncate text-xs text-muted">{recipe.source_author}</p>}
        <p className="text-sm tabular-nums text-ink">{recipe.servings_base} porcji</p>
        <p>
          <MacroSummary macros={recipe.macros_per_serving} />
        </p>
        {(recipe.diet_tags.length > 0 || recipe.allergens.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {recipe.diet_tags.map((t) => (
              <RecipeTag key={t}>{DIET_LABELS[t] ?? t}</RecipeTag>
            ))}
            {recipe.allergens.map((a) => (
              <RecipeTag key={a}>Zawiera: {(ALLERGEN_LABELS[a] ?? a).toLowerCase()}</RecipeTag>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
