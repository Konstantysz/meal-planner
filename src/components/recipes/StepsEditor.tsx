'use client';
import { Button, Input } from '@/components/ui';
import { moveItem, removeItem } from '@/lib/list-edit';

export interface EditableStep {
  title: string;
  text: string;
}

/**
 * Ordered, editable step list: add, remove, move up/down, edit title and text.
 * Controlled; the caller drops empty steps and numbers positions on save.
 * Used by `RecipeForm` and `ImportReviewForm`.
 */
export function StepsEditor({ steps, onChange }: { steps: EditableStep[]; onChange: (steps: EditableStep[]) => void }) {
  const update = (idx: number, patch: Partial<EditableStep>) =>
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  return (
    <div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
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
              <Button
                aria-label={`Przesuń krok ${i + 1} w górę`}
                disabled={i === 0}
                onClick={() => onChange(moveItem(steps, i, -1))}
                className="w-11 px-0 lg:w-9"
              >
                ↑
              </Button>
              <Button
                aria-label={`Przesuń krok ${i + 1} w dół`}
                disabled={i === steps.length - 1}
                onClick={() => onChange(moveItem(steps, i, 1))}
                className="w-11 px-0 lg:w-9"
              >
                ↓
              </Button>
              <Button
                aria-label={`Usuń krok ${i + 1}`}
                onClick={() => onChange(removeItem(steps, i))}
                className="w-11 px-0 lg:w-9"
              >
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
      <Button className="mt-2" onClick={() => onChange([...steps, { title: '', text: '' }])}>
        + krok
      </Button>
    </div>
  );
}
