'use client';
import { Button, Input } from '@/components/ui';
import { moveItem, removeItem } from '@/lib/list-edit';
import type { ExtractedIngredient } from '@/lib/import/schema';

/**
 * Editable list of the ingredient rows the import produced, before they are matched to the database
 * (`autoMatchIngredients` reads this list). Add, remove, move, edit name, amount, unit and optional flag.
 * Editing an amount or unit drops the row's source `range` text, which no longer describes it.
 */
export function ExtractedIngredientsEditor({
  rows,
  onChange,
}: {
  rows: ExtractedIngredient[];
  onChange: (rows: ExtractedIngredient[]) => void;
}) {
  const update = (idx: number, patch: Partial<ExtractedIngredient>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
            <Input
              aria-label={`Nazwa składnika z importu ${i + 1}`}
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="min-w-40 flex-1"
            />
            <Input
              aria-label={`Ilość składnika z importu ${i + 1}`}
              type="number"
              min={0}
              step="any"
              value={r.amount ?? ''}
              onChange={(e) =>
                update(i, {
                  amount: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                  range: undefined,
                })
              }
              className="w-20"
            />
            <Input
              aria-label={`Jednostka składnika z importu ${i + 1}`}
              value={r.unit ?? ''}
              onChange={(e) => update(i, { unit: e.target.value || null, range: undefined })}
              className="w-20"
            />
            <label className="flex items-center gap-1 text-sm whitespace-nowrap">
              <input type="checkbox" checked={r.optional} onChange={(e) => update(i, { optional: e.target.checked })} />
              opcjonalny
            </label>
            <Button
              aria-label={`Przesuń składnik z importu ${i + 1} w górę`}
              disabled={i === 0}
              onClick={() => onChange(moveItem(rows, i, -1))}
            >
              ↑
            </Button>
            <Button
              aria-label={`Przesuń składnik z importu ${i + 1} w dół`}
              disabled={i === rows.length - 1}
              onClick={() => onChange(moveItem(rows, i, 1))}
            >
              ↓
            </Button>
            <Button aria-label={`Usuń składnik z importu ${i + 1}`} onClick={() => onChange(removeItem(rows, i))}>
              ×
            </Button>
          </li>
        ))}
      </ul>
      <Button
        className="mt-2"
        onClick={() => onChange([...rows, { name: '', amount: null, unit: null, optional: false }])}
      >
        + składnik
      </Button>
    </div>
  );
}
