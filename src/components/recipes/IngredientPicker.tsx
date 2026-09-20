'use client';
import { useEffect, useState } from 'react';
import type { Ingredient } from '@/lib/types';

export interface PickedIngredient {
  ingredient_id: string;
  ingredient_name: string;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  position: number;
}

export function IngredientPicker({
  value, onChange,
}: { value: PickedIngredient[]; onChange: (v: PickedIngredient[]) => void }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/ingredients').then((r) => r.json()).then(setIngredients).catch(() => {});
  }, []);

  const filtered = query.length >= 2
    ? ingredients.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  function add(ing: Ingredient) {
    const raw = `${ing.name}`;
    onChange([...value, {
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      amount: null,
      unit: ing.default_unit,
      raw_text: raw,
      position: value.length,
    }]);
    setQuery('');
  }

  async function createAndAdd(name: string) {
    setCreating(true);
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, category: 'inne',
          kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null,
          default_unit: null, source: 'manual',
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

  return (
    <div className="space-y-2">
      <input
        placeholder="Szukaj składnika…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      {filtered.length > 0 && (
        <ul className="border rounded divide-y">
          {filtered.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => add(i)} className="w-full text-left px-3 py-2 hover:bg-gray-100 hover:text-black">
                {i.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.length >= 2 && filtered.length === 0 && (
        <button
          type="button"
          disabled={creating}
          onClick={() => createAndAdd(query)}
          className="w-full text-left px-3 py-2 border rounded opacity-80 hover:opacity-100"
        >
          {creating ? 'Dodaję…' : `+ Dodaj nowy składnik "${query}"`}
        </button>
      )}
      <ul className="space-y-1">
        {value.map((v, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <input
              value={v.raw_text}
              onChange={(e) => {
                const next = [...value]; next[idx] = { ...v, raw_text: e.target.value }; onChange(next);
              }}
              className="flex-1 border rounded px-2 py-1"
            />
            <input
              type="number"
              value={v.amount ?? ''}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...v, amount: e.target.value === '' ? null : Number(e.target.value) };
                onChange(next);
              }}
              className="w-20 border rounded px-2 py-1"
            />
            <input
              value={v.unit ?? ''}
              onChange={(e) => {
                const next = [...value]; next[idx] = { ...v, unit: e.target.value || null }; onChange(next);
              }}
              className="w-16 border rounded px-2 py-1"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              className="text-red-600 px-2"
            >×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
