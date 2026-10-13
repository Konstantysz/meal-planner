'use client';
import { Chip } from '@/components/ui';
import { ALLERGEN_LABELS, DIET_LABELS } from './labels';

export function RecipeFilters({
  diet,
  exclude,
  onDiet,
  onExclude,
}: {
  diet: string[];
  exclude: string[];
  onDiet: (v: string[]) => void;
  onExclude: (v: string[]) => void;
}) {
  function toggle(list: string[], v: string, setter: (x: string[]) => void) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }
  return (
    <div className="space-y-3 border-b border-line p-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Diety</legend>
        <span aria-hidden="true" className="mr-1 text-sm font-semibold">
          Diety
        </span>
        {Object.entries(DIET_LABELS).map(([slug, label]) => (
          <Chip key={slug} selected={diet.includes(slug)} onClick={() => toggle(diet, slug, onDiet)}>
            {label}
          </Chip>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Wyklucz alergeny</legend>
        <span aria-hidden="true" className="mr-1 text-sm font-semibold">
          Wyklucz
        </span>
        {Object.entries(ALLERGEN_LABELS).map(([slug, label]) => (
          <Chip key={slug} selected={exclude.includes(slug)} onClick={() => toggle(exclude, slug, onExclude)}>
            {label}
          </Chip>
        ))}
      </fieldset>
    </div>
  );
}
