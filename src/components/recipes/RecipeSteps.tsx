'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { cx } from '@/components/ui/cx';

export interface DisplayStep {
  id: string;
  title: string | null;
  text: string;
}

/**
 * Steps as collapsible cards on native `<details>` (keyboard and screen-reader semantics for free).
 * The first step starts open; „Rozwiń wszystkie" / „Zwiń wszystkie" toggles every step.
 * A step with a title shows it in the summary and the text on open. A step without one is a plain
 * numbered card: its text is the summary (two lines closed, full when open).
 */
export function RecipeSteps({ steps }: { steps: DisplayStep[] }) {
  const [open, setOpen] = useState<boolean[]>(() => steps.map((_, i) => i === 0));
  const allOpen = open.every(Boolean);

  function setOne(i: number, value: boolean) {
    setOpen((prev) => prev.map((v, j) => (j === i ? value : v)));
  }

  return (
    <section aria-labelledby="steps-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="steps-title" className="font-display text-xl font-semibold">
          Kroki
        </h2>
        {steps.length > 1 && (
          <Button onClick={() => setOpen(steps.map(() => !allOpen))}>
            {allOpen ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
          </Button>
        )}
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.id}>
            <details
              open={open[i]}
              onToggle={(e) => setOne(i, e.currentTarget.open)}
              className="group rounded-block border border-line"
            >
              <summary className="flex min-h-11 cursor-pointer items-start gap-3 p-3 [&::-webkit-details-marker]:hidden marker:content-none">
                <span aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-90">
                  ›
                </span>
                <span className="w-6 shrink-0 font-display font-semibold tabular-nums text-muted">{i + 1}.</span>
                {s.title ? (
                  <span className="font-medium">{s.title}</span>
                ) : (
                  <span className={cx(!open[i] && 'line-clamp-2')}>
                    <span className="sr-only">Krok {i + 1}: </span>
                    {s.text}
                  </span>
                )}
              </summary>
              {s.title && <p className="whitespace-pre-line border-t border-line p-3 pl-12">{s.text}</p>}
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
