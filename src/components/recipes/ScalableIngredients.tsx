'use client';
import { useState } from 'react';
import { formatAmount } from '@/lib/scaling';
import { Button } from '@/components/ui';

export interface IngredientLine {
  id: string;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  optional: boolean;
}

const MAX_SERVINGS = 99;

/** Ingredient list with a servings stepper: amounts scale by `servings / baseServings` (display only). */
export function ScalableIngredients({ lines, baseServings }: { lines: IngredientLine[]; baseServings: number }) {
  const [servings, setServings] = useState(baseServings);
  const factor = baseServings > 0 ? servings / baseServings : 1;

  return (
    <section aria-labelledby="ingredients-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <h2 id="ingredients-heading" className="font-display text-xl font-semibold">
          Składniki
        </h2>
        <div role="group" aria-label="Liczba porcji" className="flex items-center gap-1">
          <Button
            aria-label="Mniej porcji"
            disabled={servings <= 1}
            onClick={() => setServings(servings - 1)}
            className="w-11 px-0 lg:w-9"
          >
            −
          </Button>
          <output aria-live="polite" className="min-w-20 text-center tabular-nums">
            {servings} porcji
          </output>
          <Button
            aria-label="Więcej porcji"
            disabled={servings >= MAX_SERVINGS}
            onClick={() => setServings(servings + 1)}
            className="w-11 px-0 lg:w-9"
          >
            +
          </Button>
        </div>
      </div>
      {servings !== baseServings && (
        <p className="mt-2 text-[13px] text-muted">
          Przepis jest na {baseServings} porcji.{' '}
          <Button variant="link" className="min-h-11 text-[13px]" onClick={() => setServings(baseServings)}>
            Przywróć
          </Button>
        </p>
      )}
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={l.id} className="py-2">
            {l.amount != null && <span className="tabular-nums">{formatAmount(l.amount * factor, l.unit)} </span>}
            {l.raw_text}
            {l.optional && <span className="text-muted"> (opcjonalnie)</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
