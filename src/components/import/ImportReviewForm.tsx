'use client';
import { useState } from 'react';
import type { RecipeJsonLd } from '@/lib/schemas';
import type { Ingredient } from '@/lib/types';
import { IngredientPicker, type PickedIngredient } from '@/components/recipes/IngredientPicker';
import { autoMatchIngredients } from '@/lib/import/auto-match';

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
  const [notice, setNotice] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  async function autoMatch() {
    setMatching(true);
    setError(null);
    setNotice(null);
    try {
      const localIngredients: Ingredient[] = await fetch('/api/ingredients').then((r) => r.json());
      const results = await autoMatchIngredients(
        extracted.recipeIngredient,
        localIngredients,
        { searchOff: (q) => fetch(`/api/ingredients/lookup?q=${encodeURIComponent(q)}`).then((r) => r.json()) }
      );

      const picked: PickedIngredient[] = [];
      let createdCount = 0;
      for (const r of results) {
        let ingredient = r.ingredient;
        const toCreate = r.offCandidate ?? r.fallbackCandidate;
        if (!ingredient && toCreate) {
          const created = await fetch('/api/ingredients', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toCreate),
          });
          if (created.ok) { ingredient = await created.json(); createdCount++; }
        }
        if (!ingredient) continue;
        picked.push({
          ingredient_id: ingredient.id, ingredient_name: ingredient.name,
          amount: r.amount, unit: r.unit ?? ingredient.default_unit,
          raw_text: r.raw_text, position: picked.length,
        });
      }
      setIngredients(picked);
      if (createdCount > 0) {
        setNotice(`Dopasowano wszystkie ${picked.length} składników (${createdCount} nowo utworzonych — sprawdź makra).`);
      } else if (picked.length < extracted.recipeIngredient.length) {
        setNotice(`Dopasowano ${picked.length} z ${extracted.recipeIngredient.length} składników. Uzupełnij resztę ręcznie.`);
      } else {
        setNotice(`Dopasowano wszystkie ${picked.length} składników.`);
      }
    } finally {
      setMatching(false);
    }
  }

  async function save() {
    if (ingredients.length === 0) {
      setError('Zmapuj co najmniej jeden składnik przed zapisem.');
      return;
    }
    setError(null);
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
      <p className="text-sm bg-amber-50 text-amber-900 p-2 rounded">
        Sprawdź i uzupełnij dane z importu. Lista składników wymaga mapowania na bazę.
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2" />
      <input type="number" value={servings} min={1} onChange={(e) => setServings(Number(e.target.value))}
        className="w-24 border rounded px-2 py-1" />
      <div>
        <h3 className="font-semibold">Składniki (z importu: {extracted.recipeIngredient.length})</h3>
        <ul className="text-sm opacity-70 mb-2">
          {extracted.recipeIngredient.map((x, i) => <li key={i}>· {x}</li>)}
        </ul>
        <button
          type="button" onClick={autoMatch} disabled={matching}
          className="text-sm border rounded px-3 py-1 mb-2 disabled:opacity-50"
        >
          {matching ? 'Dopasowuję…' : 'Auto-mapuj składniki'}
        </button>
        <p className="text-sm opacity-70 mb-2">Zmapuj na bazę:</p>
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
      {notice && <p className="text-sm bg-blue-50 text-blue-900 p-2 rounded">{notice}</p>}
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
