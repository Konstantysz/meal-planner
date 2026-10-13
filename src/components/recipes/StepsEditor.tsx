'use client';
import { Button, Input } from '@/components/ui';

export interface RecipeFormStep {
  title: string;
  text: string;
}

/**
 * Controlled editor for a recipe's steps: optional title, text, move up/down, remove, add.
 * Shared by `RecipeForm` and `ImportReviewForm`. Empty steps are dropped by the caller on save.
 */
export function StepsEditor({ value, onChange }: { value: RecipeFormStep[]; onChange: (v: RecipeFormStep[]) => void }) {
  function update(idx: number, patch: Partial<RecipeFormStep>) {
    onChange(value.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  return (
    <div>
      <ol className="space-y-3">
        {value.map((s, i) => (
          <li key={i} className="space-y-2 border-b border-line pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-muted tabular-nums">{i + 1}.</span>
              <Input
                aria-label={`Tytuł kroku ${i + 1}`}
                value={s.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Tytuł kroku (opcjonalnie)"
                maxLength={200}
                className="min-w-40 flex-1"
              />
              <Button aria-label={`Przesuń krok ${i + 1} w górę`} disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </Button>
              <Button
                aria-label={`Przesuń krok ${i + 1} w dół`}
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              <Button aria-label={`Usuń krok ${i + 1}`} onClick={() => onChange(value.filter((_, x) => x !== i))}>
                ×
              </Button>
            </div>
            <textarea
              aria-label={`Treść kroku ${i + 1}`}
              value={s.text}
              onChange={(e) => update(i, { text: e.target.value })}
              rows={3}
              className="w-full rounded-control border border-line bg-background px-3 py-2 text-base text-ink lg:text-sm"
            />
          </li>
        ))}
      </ol>
      <Button className="mt-2" onClick={() => onChange([...value, { title: '', text: '' }])}>
        + krok
      </Button>
    </div>
  );
}
