'use client';
import { Chip } from '@/components/ui';
import { ALLERGEN_LABELS, DIET_LABELS } from '@/lib/recipe-labels';
import type { Allergen, DietTag } from '@/lib/types';

const DIETS = Object.keys(DIET_LABELS) as DietTag[];
const ALLERGENS = Object.keys(ALLERGEN_LABELS) as Allergen[];

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
    <div className="space-y-3 border-b border-line px-4 py-3 lg:px-8">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Diety</legend>
        <span aria-hidden="true" className="w-16 text-sm font-semibold">
          Diety
        </span>
        {DIETS.map((d) => (
          <Chip key={d} selected={diet.includes(d)} onClick={() => toggle(diet, d, onDiet)}>
            {DIET_LABELS[d]}
          </Chip>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Wyklucz alergeny</legend>
        <span aria-hidden="true" className="w-16 text-sm font-semibold">
          Wyklucz
        </span>
        {ALLERGENS.map((a) => (
          <Chip key={a} selected={exclude.includes(a)} onClick={() => toggle(exclude, a, onExclude)}>
            {ALLERGEN_LABELS[a]}
          </Chip>
        ))}
      </fieldset>
    </div>
  );
}
