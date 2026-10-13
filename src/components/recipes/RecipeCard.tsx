import Link from 'next/link';
import type { RecipeListItem } from '@/lib/db/recipes';
import { ALLERGEN_LABELS, DIET_LABELS } from '@/lib/recipe-labels';
import { Icon, Tag } from '@/components/ui';
import { slotClass } from '@/components/plan/slot-colors';
import { MacroSummary } from './MacroSummary';

/**
 * Steam-style shelf item: a 3:4 cover (recipe name on the slot colour, time on top) over a hairline-separated
 * info block. The cover is `relative overflow-hidden`, so a photo can later fill it (`absolute inset-0`, with
 * the name on a bottom gradient) without changing the layout (design brief, "Recipe cover and photos").
 */
export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const cover = recipe.cover_position === null ? 'bg-hover text-ink' : slotClass(recipe.cover_position, true);
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="flex h-full flex-col rounded-block border border-line hover:bg-hover"
    >
      <div
        className={`relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-t-block p-3 ${cover}`}
      >
        <span className="flex min-h-5 items-center gap-1 text-xs">
          {recipe.prep_time_min != null && (
            <>
              <Icon name="time" width={14} height={14} />
              {recipe.prep_time_min} min
            </>
          )}
        </span>
        <h3 className="font-display text-[21px] leading-tight font-extrabold tracking-tight break-words hyphens-auto text-balance">
          {recipe.name}
        </h3>
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">
        <p className="text-[13px] text-muted">
          {recipe.source_author && <span className="text-ink">{recipe.source_author} · </span>}
          {recipe.servings_base} porcji
        </p>
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
        <div className="mt-auto">
          <MacroSummary macros={recipe.macros_per_serving} />
        </div>
      </div>
    </Link>
  );
}
