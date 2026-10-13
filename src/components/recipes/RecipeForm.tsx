'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { IngredientPicker, type PickedIngredient } from './IngredientPicker';

const DIETS = ['wegetarianska', 'ketogeniczna', 'bezglutenowa'] as const;
const ALLERGENS = ['gluten', 'mieso', 'nabial', 'orzechy', 'ryby'] as const;

export interface RecipeFormStep {
  title: string;
  text: string;
}

export interface RecipeFormInitialValues {
  name: string;
  servings_base: number;
  prep_time_min: number | null;
  source_url?: string | null;
  source_author?: string | null;
  visibility?: 'private' | 'household' | 'public_link';
  diet_tags: string[];
  allergens: string[];
  ingredients: PickedIngredient[];
  steps: RecipeFormStep[];
}

/**
 * Create form (no `recipeId`: POST /api/recipes) and edit form (`recipeId` set: PUT /api/recipes/[id]).
 * Ingredient and step positions are renumbered from the list order on submit.
 */
export function RecipeForm({
  initialValues,
  recipeId,
}: { initialValues?: RecipeFormInitialValues; recipeId?: string } = {}) {
  const router = useRouter();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [servings, setServings] = useState(initialValues?.servings_base ?? 4);
  const [prepTime, setPrepTime] = useState<number | null>(initialValues?.prep_time_min ?? null);
  const [sourceAuthor, setSourceAuthor] = useState(initialValues?.source_author ?? '');
  const [dietTags, setDietTags] = useState<string[]>(initialValues?.diet_tags ?? []);
  const [allergens, setAllergens] = useState<string[]>(initialValues?.allergens ?? []);
  const [ingredients, setIngredients] = useState<PickedIngredient[]>(initialValues?.ingredients ?? []);
  const [steps, setSteps] = useState<RecipeFormStep[]>(initialValues?.steps ?? [{ title: '', text: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateStep(idx: number, patch: Partial<RecipeFormStep>) {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSteps(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(recipeId ? `/api/recipes/${recipeId}` : '/api/recipes', {
      method: recipeId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        servings_base: servings,
        prep_time_min: prepTime,
        source_url: initialValues?.source_url ?? null,
        source_author: sourceAuthor.trim() || null,
        visibility: initialValues?.visibility ?? 'household',
        diet_tags: dietTags,
        allergens,
        ingredients: ingredients.map((i, position) => ({
          ingredient_id: i.ingredient_id,
          amount: i.amount,
          unit: i.unit,
          raw_text: i.raw_text,
          position,
          optional: i.optional,
        })),
        steps: steps
          .filter((s) => s.text.trim())
          .map((s, position) => ({ position, title: s.title.trim() || null, text: s.text })),
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
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6 p-4">
      <Input
        required
        aria-label="Nazwa przepisu"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nazwa przepisu"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Liczba porcji"
          type="number"
          min={1}
          value={servings}
          onChange={(e) => setServings(Number(e.target.value))}
          className="w-24"
        />
        <span>porcji, czas (min):</span>
        <Input
          aria-label="Czas przygotowania (min)"
          type="number"
          min={0}
          value={prepTime ?? ''}
          onChange={(e) => setPrepTime(e.target.value === '' ? null : Number(e.target.value))}
          className="w-24"
        />
      </div>
      <label className="block">
        <span className="font-semibold">Autor przepisu</span>
        <Input
          value={sourceAuthor}
          onChange={(e) => setSourceAuthor(e.target.value)}
          placeholder="np. Ania Gotuje"
          maxLength={200}
        />
      </label>
      <fieldset>
        <legend className="font-semibold">Diety</legend>
        {DIETS.map((d) => (
          <label key={d} className="mr-4">
            <input
              type="checkbox"
              checked={dietTags.includes(d)}
              onChange={(e) => setDietTags(e.target.checked ? [...dietTags, d] : dietTags.filter((x) => x !== d))}
            />{' '}
            {d}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="font-semibold">Alergeny</legend>
        {ALLERGENS.map((a) => (
          <label key={a} className="mr-4">
            <input
              type="checkbox"
              checked={allergens.includes(a)}
              onChange={(e) => setAllergens(e.target.checked ? [...allergens, a] : allergens.filter((x) => x !== a))}
            />{' '}
            {a}
          </label>
        ))}
      </fieldset>
      <div>
        <h3 className="mb-2 font-semibold">Składniki</h3>
        <IngredientPicker value={ingredients} onChange={setIngredients} />
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Kroki</h3>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="space-y-2 border-b border-line pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-muted tabular-nums">{i + 1}.</span>
                <Input
                  aria-label={`Tytuł kroku ${i + 1}`}
                  value={s.title}
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                  placeholder="Tytuł kroku (opcjonalnie)"
                  maxLength={200}
                  className="min-w-40 flex-1"
                />
                <Button aria-label={`Przesuń krok ${i + 1} w górę`} disabled={i === 0} onClick={() => moveStep(i, -1)}>
                  ↑
                </Button>
                <Button
                  aria-label={`Przesuń krok ${i + 1} w dół`}
                  disabled={i === steps.length - 1}
                  onClick={() => moveStep(i, 1)}
                >
                  ↓
                </Button>
                <Button aria-label={`Usuń krok ${i + 1}`} onClick={() => setSteps(steps.filter((_, x) => x !== i))}>
                  ×
                </Button>
              </div>
              <textarea
                aria-label={`Treść kroku ${i + 1}`}
                value={s.text}
                onChange={(e) => updateStep(i, { text: e.target.value })}
                rows={3}
                className="w-full rounded-control border border-line bg-background px-3 py-2 text-base text-ink lg:text-sm"
              />
            </li>
          ))}
        </ol>
        <Button className="mt-2" onClick={() => setSteps([...steps, { title: '', text: '' }])}>
          + krok
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-control border border-brand px-3 py-2">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? 'Zapisuję…' : recipeId ? 'Zapisz zmiany' : 'Zapisz przepis'}
      </Button>
    </form>
  );
}
