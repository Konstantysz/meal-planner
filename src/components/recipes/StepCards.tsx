'use client';
import { useState } from 'react';
import { Button, Icon } from '@/components/ui';

export interface StepLine {
  id: string;
  title: string | null;
  text: string;
}

/**
 * Steps as cards. A step with a title is a native `<details>` (keyboard and screen-reader semantics come from
 * `<summary>`), open for the first step by default; a step without a title is a plain numbered card with nothing
 * to collapse. "Rozwiń wszystkie" / "Zwiń wszystkie" acts on the titled steps.
 */
export function StepCards({ steps }: { steps: StepLine[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(steps.slice(0, 1).map((s) => s.id)));
  const titled = steps.filter((s) => s.title);
  const allOpen = titled.length > 0 && titled.every((s) => open.has(s.id));

  function setStep(id: string, value: boolean) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <section aria-labelledby="steps-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <h2 id="steps-heading" className="font-display text-xl font-semibold">
          Kroki
        </h2>
        {titled.length > 0 && (
          <Button onClick={() => setOpen(allOpen ? new Set() : new Set(titled.map((s) => s.id)))}>
            {allOpen ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
          </Button>
        )}
      </div>
      <ol className="mt-3 max-w-prose space-y-2">
        {steps.map((s, i) =>
          s.title ? (
            <li key={s.id}>
              <details
                open={open.has(s.id)}
                onToggle={(e) => setStep(s.id, e.currentTarget.open)}
                className="group rounded-block border border-line"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 hover:bg-hover [&::-webkit-details-marker]:hidden">
                  <span className="w-6 text-muted tabular-nums">{i + 1}.</span>
                  <span className="flex-1 font-semibold">{s.title}</span>
                  <Icon
                    name="next"
                    width={18}
                    height={18}
                    className="text-faint transition-transform group-open:rotate-90"
                  />
                </summary>
                <p className="border-t border-line px-3 py-3 pl-12 whitespace-pre-line">{s.text}</p>
              </details>
            </li>
          ) : (
            <li key={s.id} className="flex gap-3 rounded-block border border-line px-3 py-3">
              <span className="w-6 shrink-0 text-muted tabular-nums">{i + 1}.</span>
              <p className="whitespace-pre-line">{s.text}</p>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
