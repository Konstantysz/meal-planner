'use client';
import { useEffect, useState } from 'react';
import type { Ingredient } from '@/lib/types';
import { Button, Input } from '@/components/ui';

export interface PickedIngredient {
  ingredient_id: string;
  ingredient_name: string;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  position: number;
  optional: boolean;
}

export function IngredientPicker({
  value,
  onChange,
}: {
  value: PickedIngredient[];
  onChange: (v: PickedIngredient[]) => void;
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/ingredients')
      .then((r) => r.json())
      .then(setIngredients)
      .catch(() => {});
  }, []);

  const filtered =
    query.length >= 2 ? ingredients.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];

  function add(ing: Ingredient) {
    const raw = `${ing.name}`;
    onChange([
      ...value,
      {
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        amount: null,
        unit: ing.default_unit,
        raw_text: raw,
        position: value.length,
        optional: false,
      },
    ]);
    setQuery('');
  }

  async function createAndAdd(name: string) {
    setCreating(true);
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: 'inne',
          kcal_per_100g: null,
          protein_per_100g: null,
          fat_per_100g: null,
          carbs_per_100g: null,
          default_unit: null,
          source: 'manual',
        }),
      });
      if (!res.ok) return;
      const ing: Ingredient = await res.json();
      setIngredients((prev) => [...prev, ing]);
      add(ing);
    } finally {
      setCreating(false);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next.map((v, i) => ({ ...v, position: i })));
  }

  const update = (idx: number, patch: Partial<PickedIngredient>) =>
    onChange(value.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  return (
    <div className="space-y-2">
      <Input placeholder="Szukaj składnika…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {filtered.length > 0 && (
        <ul className="rounded-control border border-line divide-y divide-line">
          {filtered.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => add(i)} className="min-h-11 w-full px-3 text-left hover:bg-hover">
                {i.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.length >= 2 && filtered.length === 0 && (
        <Button disabled={creating} onClick={() => createAndAdd(query)} className="w-full justify-start">
          {creating ? 'Dodaję…' : `+ Dodaj nowy składnik "${query}"`}
        </Button>
      )}
      <ul className="space-y-3">
        {value.map((v, idx) => (
          <li key={idx} className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
            <Input
              aria-label="Składnik"
              value={v.raw_text}
              onChange={(e) => update(idx, { raw_text: e.target.value })}
              className="basis-full"
            />
            <Input
              aria-label="Ilość"
              type="number"
              value={v.amount ?? ''}
              onChange={(e) => update(idx, { amount: e.target.value === '' ? null : Number(e.target.value) })}
              className="max-w-24"
            />
            <Input
              aria-label="Jednostka"
              value={v.unit ?? ''}
              onChange={(e) => update(idx, { unit: e.target.value || null })}
              className="max-w-24"
            />
            <label className="flex items-center gap-1 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={v.optional}
                onChange={(e) => update(idx, { optional: e.target.checked })}
              />
              opcjonalny
            </label>
            <Button aria-label="Przesuń składnik w górę" disabled={idx === 0} onClick={() => move(idx, -1)}>
              ↑
            </Button>
            <Button
              aria-label="Przesuń składnik w dół"
              disabled={idx === value.length - 1}
              onClick={() => move(idx, 1)}
            >
              ↓
            </Button>
            <Button
              aria-label="Usuń składnik"
              onClick={() => onChange(value.filter((_, i) => i !== idx).map((x, i) => ({ ...x, position: i })))}
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
