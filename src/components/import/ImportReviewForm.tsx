'use client';
import { useState } from 'react';
import type { ExtractedIngredient, ExtractedRecipe } from '@/lib/import/schema';
import type { Ingredient } from '@/lib/types';
import { IngredientPicker, type PickedIngredient } from '@/components/recipes/IngredientPicker';
import { OffDisclaimer } from '@/components/recipes/OffDisclaimer';
import { StepsEditor, type EditableStep } from '@/components/recipes/StepsEditor';
import { ExtractedIngredientsEditor } from './ExtractedIngredientsEditor';
import { autoMatchIngredients } from '@/lib/import/auto-match';
import { parsePrepMinutes } from '@/lib/import/duration';
import { normalizeUnit } from '@/lib/import/unit';
import { parseYield, yieldWeightGrams } from '@/lib/import/yield';

export function ImportReviewForm({
  extracted,
  sourceUrl,
  imageUrl,
  onCancel,
  onSaved,
}: {
  extracted: ExtractedRecipe;
  sourceUrl: string;
  imageUrl?: string | null;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(extracted.name);
  const [servings, setServings] = useState(parseYield(extracted.recipeYield));
  const [photoUrl, setPhotoUrl] = useState(imageUrl ?? '');
  const [prepTime, setPrepTime] = useState<number | null>(parsePrepMinutes(extracted.prepTime));
  const totalGrams = yieldWeightGrams(extracted.recipeYield);
  const [ingredients, setIngredients] = useState<PickedIngredient[]>([]);
  // Editable copy of the imported rows; auto-match reads it, so removed or corrected rows are respected.
  const [rows, setRows] = useState<ExtractedIngredient[]>(extracted.recipeIngredient);
  const [sourceAuthor, setSourceAuthor] = useState('');
  const [steps, setSteps] = useState<EditableStep[]>(
    extracted.recipeInstructions.map((s) => ({ title: s.title ?? '', text: s.text })),
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
      const toMatch = rows
        .filter((r) => r.name.trim())
        .map((r) => ({ ...r, unit: r.unit ? (normalizeUnit(r.unit.trim()) ?? r.unit.trim()) : null }));
      const results = await autoMatchIngredients(toMatch, localIngredients, {
        searchOff: (q) => fetch(`/api/ingredients/lookup?q=${encodeURIComponent(q)}`).then((r) => r.json()),
      });

      const picked: PickedIngredient[] = [];
      let createdCount = 0;
      for (const r of results) {
        let ingredient = r.ingredient;
        const toCreate = r.offCandidate ?? r.fallbackCandidate;
        if (!ingredient && toCreate) {
          const created = await fetch('/api/ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toCreate),
          });
          if (created.ok) {
            ingredient = await created.json();
            createdCount++;
          }
        }
        if (!ingredient) continue;
        picked.push({
          ingredient_id: ingredient.id,
          ingredient_name: ingredient.name,
          amount: r.amount,
          unit: r.unit ?? ingredient.default_unit,
          raw_text: r.raw_text,
          position: picked.length,
          optional: r.optional ?? false,
        });
      }
      setIngredients(picked);
      if (createdCount > 0) {
        setNotice(
          `Dopasowano wszystkie ${picked.length} składników (${createdCount} nowo utworzonych — sprawdź makra).`,
        );
      } else if (picked.length < toMatch.length) {
        setNotice(`Dopasowano ${picked.length} z ${toMatch.length} składników. Uzupełnij resztę ręcznie.`);
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
    const cleanSteps = steps.filter((s) => s.text.trim());
    if (cleanSteps.length === 0) {
      setError('Dodaj co najmniej jeden krok.');
      return;
    }
    setError(null);
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        servings_base: servings,
        prep_time_min: prepTime,
        source_url: sourceUrl || null,
        image_url: photoUrl.trim() || null,
        source_author: sourceAuthor.trim() || null,
        visibility: 'household',
        diet_tags: [],
        allergens: [],
        ingredients: ingredients.map((i) => ({
          ingredient_id: i.ingredient_id,
          amount: i.amount,
          unit: i.unit,
          raw_text: i.raw_text,
          position: i.position,
          optional: i.optional,
        })),
        steps: cleanSteps.map((s, i) => ({ position: i, title: s.title.trim() || null, text: s.text })),
      }),
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const msg = (body as { error?: unknown } | null)?.error;
      setError(typeof msg === 'string' ? msg : 'Nie udało się zapisać przepisu.');
      return;
    }
    const r = await res.json();
    onSaved(r.id);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <p className="text-sm bg-amber-50 text-amber-900 p-2 rounded">
        Sprawdź i uzupełnij dane z importu. Lista składników wymaga mapowania na bazę.
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2" />
      <label className="block text-sm">
        Zdjęcie (adres URL)
        <input
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://…"
          maxLength={2048}
          className="w-full border rounded px-3 py-2 mt-1"
        />
      </label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={servings}
          min={1}
          onChange={(e) => setServings(Number(e.target.value))}
          aria-label="Porcje"
          className="w-24 border rounded px-2 py-1"
        />
        <label className="flex items-center gap-1 text-sm">
          Czas (min)
          <input
            type="number"
            min={0}
            step={1}
            value={prepTime ?? ''}
            onChange={(e) =>
              setPrepTime(e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))
            }
            className="w-24 border rounded px-2 py-1"
          />
        </label>
        {totalGrams !== null && servings >= 1 && (
          <span className="text-sm opacity-70">
            Przepis podaje wagę ({totalGrams} g) — porcja ok. {Math.round(totalGrams / servings)} g. Popraw liczbę
            porcji, jeśli to nie pasuje.
          </span>
        )}
      </div>
      <label className="block text-sm">
        Autor przepisu
        <input
          value={sourceAuthor}
          onChange={(e) => setSourceAuthor(e.target.value)}
          placeholder="np. Ania Gotuje"
          maxLength={200}
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <div>
        <h3 className="font-semibold">Składniki z importu ({rows.length})</h3>
        <ExtractedIngredientsEditor rows={rows} onChange={setRows} />
        <button
          type="button"
          onClick={autoMatch}
          disabled={matching}
          className="text-sm border rounded px-3 py-1 mb-2 disabled:opacity-50"
        >
          {matching ? 'Dopasowuję…' : 'Auto-mapuj składniki'}
        </button>
        <OffDisclaimer className="mb-2" />
        <p className="text-sm opacity-70 mb-2">Zmapuj na bazę:</p>
        <IngredientPicker value={ingredients} onChange={setIngredients} />
      </div>
      <div>
        <h3 className="font-semibold">Kroki</h3>
        <StepsEditor steps={steps} onChange={setSteps} />
      </div>
      {notice && <p className="text-sm bg-blue-50 text-blue-900 p-2 rounded">{notice}</p>}
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-2 border rounded">
          Anuluj
        </button>
        <button onClick={save} className="bg-green-600 text-white rounded px-4 py-2">
          Zapisz przepis
        </button>
      </div>
    </div>
  );
}
