'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { formatAmount, scaleAmount } from '@/lib/scaling';

export interface DisplayIngredient {
  id: string;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  optional: boolean;
}

/** Ingredient list with a servings stepper; amounts scale from the base servings (`scaleAmount`). */
export function RecipeIngredients({
  ingredients,
  baseServings,
}: {
  ingredients: DisplayIngredient[];
  baseServings: number;
}) {
  const [servings, setServings] = useState(baseServings);
  const factor = baseServings > 0 ? servings / baseServings : 1;

  return (
    <section aria-labelledby="ingredients-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="ingredients-title" className="font-display text-xl font-semibold">
          Składniki
        </h2>
        <div className="flex items-center gap-1" role="group" aria-label="Skaluj składniki">
          <Button aria-label="Mniej porcji" disabled={servings <= 1} onClick={() => setServings(servings - 1)}>
            −
          </Button>
          <span className="min-w-20 text-center tabular-nums" aria-live="polite">
            {servings} porcji
          </span>
          <Button aria-label="Więcej porcji" onClick={() => setServings(servings + 1)}>
            +
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-line border-y border-line">
        {ingredients.map((ri) => {
          const scaled = ri.amount != null ? scaleAmount(ri, factor) : null;
          return (
            <li key={ri.id} className="py-2">
              {scaled?.amount != null && (
                <span className="tabular-nums">{formatAmount(scaled.amount, scaled.unit)} </span>
              )}
              {ri.raw_text}
              {ri.optional && <span className="text-muted"> (opcjonalnie)</span>}
            </li>
          );
        })}
      </ul>
      {servings !== baseServings && (
        <p className="mt-2 text-sm text-muted">
          Przeliczone z {baseServings} porcji. Makro na porcję się nie zmieniają.
        </p>
      )}
    </section>
  );
}
