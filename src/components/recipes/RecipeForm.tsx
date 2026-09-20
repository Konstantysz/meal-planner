'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IngredientPicker, type PickedIngredient } from './IngredientPicker';

const DIETS = ['wegetarianska', 'ketogeniczna', 'bezglutenowa'] as const;
const ALLERGENS = ['gluten', 'mieso', 'nabial', 'orzechy', 'ryby'] as const;

export interface RecipeFormInitialValues {
  name: string;
  servings_base: number;
  prep_time_min: number | null;
  diet_tags: string[];
  allergens: string[];
  ingredients: PickedIngredient[];
  steps: string[];
}

export function RecipeForm({
  initialValues, readOnly = false,
}: { initialValues?: RecipeFormInitialValues; readOnly?: boolean } = {}) {
  const router = useRouter();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [servings, setServings] = useState(initialValues?.servings_base ?? 4);
  const [prepTime, setPrepTime] = useState<number | null>(initialValues?.prep_time_min ?? null);
  const [dietTags, setDietTags] = useState<string[]>(initialValues?.diet_tags ?? []);
  const [allergens, setAllergens] = useState<string[]>(initialValues?.allergens ?? []);
  const [ingredients, setIngredients] = useState<PickedIngredient[]>(initialValues?.ingredients ?? []);
  const [steps, setSteps] = useState<string[]>(initialValues?.steps ?? ['']);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        servings_base: servings,
        prep_time_min: prepTime,
        source_url: null,
        visibility: 'household',
        diet_tags: dietTags,
        allergens,
        ingredients: ingredients.map((i) => ({
          ingredient_id: i.ingredient_id,
          amount: i.amount,
          unit: i.unit,
          raw_text: i.raw_text,
          position: i.position,
        })),
        steps: steps.filter((s) => s.trim()).map((text, i) => ({ position: i, text })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Błąd zapisu');
      return;
    }
    const recipe = await res.json();
    router.push(`/recipes/${recipe.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl mx-auto p-4">
      <fieldset disabled={readOnly} className="space-y-4">
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa przepisu" className="w-full border rounded px-3 py-2" />
      <div className="flex gap-2">
        <input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} className="w-24 border rounded px-2 py-1" />
        <span className="self-center">porcji, czas (min):</span>
        <input type="number" min={0} value={prepTime ?? ''} onChange={(e) => setPrepTime(e.target.value === '' ? null : Number(e.target.value))} className="w-24 border rounded px-2 py-1" />
      </div>
      <fieldset>
        <legend className="font-semibold">Diety</legend>
        {DIETS.map((d) => (
          <label key={d} className="mr-4">
            <input type="checkbox" checked={dietTags.includes(d)}
              onChange={(e) => setDietTags(e.target.checked ? [...dietTags, d] : dietTags.filter((x) => x !== d))} /> {d}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="font-semibold">Alergeny</legend>
        {ALLERGENS.map((a) => (
          <label key={a} className="mr-4">
            <input type="checkbox" checked={allergens.includes(a)}
              onChange={(e) => setAllergens(e.target.checked ? [...allergens, a] : allergens.filter((x) => x !== a))} /> {a}
          </label>
        ))}
      </fieldset>
      <div>
        <h3 className="font-semibold">Składniki</h3>
        <IngredientPicker value={ingredients} onChange={setIngredients} />
      </div>
      <div>
        <h3 className="font-semibold">Kroki</h3>
        {steps.map((s, i) => (
          <div key={i} className="flex gap-2 my-1">
            <textarea value={s} onChange={(e) => {
              const n = [...steps]; n[i] = e.target.value; setSteps(n);
            }} className="flex-1 border rounded px-2 py-1" />
            <button type="button" onClick={() => setSteps(steps.filter((_, x) => x !== i))} className="text-red-600">×</button>
          </div>
        ))}
        <button type="button" onClick={() => setSteps([...steps, ''])} className="text-green-700">+ krok</button>
      </div>
      </fieldset>
      {error && <p className="text-red-600">{error}</p>}
      {!readOnly && (
        <button type="submit" disabled={saving} className="bg-green-600 text-white rounded px-4 py-2">
          {saving ? 'Zapisuję…' : 'Zapisz przepis'}
        </button>
      )}
    </form>
  );
}
