'use client';
import { useState } from 'react';
import type { RecipeJsonLd } from '@/lib/schemas';
import { IngredientPicker, type PickedIngredient } from '@/components/recipes/IngredientPicker';

export function ImportReviewForm({
  extracted, sourceUrl, onCancel, onSaved,
}: {
  extracted: RecipeJsonLd; sourceUrl: string;
  onCancel: () => void; onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(extracted.name);
  const [servings, setServings] = useState(parseYield(extracted.recipeYield));
  const [ingredients, setIngredients] = useState<PickedIngredient[]>([]);
  const [steps, setSteps] = useState<string[]>(
    Array.isArray(extracted.recipeInstructions)
      ? extracted.recipeInstructions.map((s) => typeof s === 'string' ? s : s.text)
      : [extracted.recipeInstructions as string]
  );
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const res = await fetch('/api/recipes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, servings_base: servings, prep_time_min: null,
        source_url: sourceUrl || null, visibility: 'household',
        diet_tags: [], allergens: [],
        ingredients: ingredients.map((i) => ({
          ingredient_id: i.ingredient_id, amount: i.amount, unit: i.unit,
          raw_text: i.raw_text, position: i.position,
        })),
        steps: steps.filter((s) => s.trim()).map((text, i) => ({ position: i, text })),
      }),
    });
    if (!res.ok) { setError((await res.json()).error ?? 'save failed'); return; }
    const r = await res.json();
    onSaved(r.id);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <p className="text-sm bg-amber-50 p-2 rounded">
        Sprawdź i uzupełnij dane z importu. Lista składników wymaga mapowania na bazę.
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2" />
      <input type="number" value={servings} min={1} onChange={(e) => setServings(Number(e.target.value))}
        className="w-24 border rounded px-2 py-1" />
      <div>
        <h3 className="font-semibold">Składniki (z importu: {extracted.recipeIngredient.length})</h3>
        <ul className="text-sm text-gray-600 mb-2">
          {extracted.recipeIngredient.map((x, i) => <li key={i}>· {x}</li>)}
        </ul>
        <p className="text-sm text-gray-500 mb-2">Zmapuj na bazę:</p>
        <IngredientPicker value={ingredients} onChange={setIngredients} />
      </div>
      <div>
        <h3 className="font-semibold">Kroki</h3>
        {steps.map((s, i) => (
          <textarea key={i} value={s} onChange={(e) => {
            const n = [...steps]; n[i] = e.target.value; setSteps(n);
          }} className="w-full border rounded px-2 py-1 my-1" />
        ))}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-2 border rounded">Anuluj</button>
        <button onClick={save} className="bg-green-600 text-white rounded px-4 py-2">Zapisz przepis</button>
      </div>
    </div>
  );
}

function parseYield(y: string | number | undefined): number {
  if (typeof y === 'number') return Math.max(1, Math.round(y));
  if (!y) return 4;
  const m = y.match(/(\d+)/);
  return m ? Math.max(1, Number(m[1])) : 4;
}
