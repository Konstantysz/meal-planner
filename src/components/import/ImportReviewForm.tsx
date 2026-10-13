'use client';
import { useState } from 'react';
import type { ExtractedRecipe } from '@/lib/import/schema';
import type { Ingredient } from '@/lib/types';
import { IngredientPicker, type PickedIngredient } from '@/components/recipes/IngredientPicker';
import { StepsEditor, type RecipeFormStep } from '@/components/recipes/StepsEditor';
import { Button, Input, Tag } from '@/components/ui';
import { autoMatchIngredients } from '@/lib/import/auto-match';
import { parsePrepMinutes } from '@/lib/import/duration';
import { parseYield, yieldWeightGrams } from '@/lib/import/yield';

type MatchStatus = 'matched' | 'created' | 'unmatched';
interface MatchOutcome {
  status: MatchStatus;
  ingredientName: string | null;
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  matched: 'Dopasowano',
  created: 'Utworzono — sprawdź makra',
  unmatched: 'Nie dopasowano — dodaj ręcznie',
};

export function ImportReviewForm({
  extracted,
  sourceUrl,
  onCancel,
  onSaved,
}: {
  extracted: ExtractedRecipe;
  sourceUrl: string;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(extracted.name);
  const [servings, setServings] = useState(parseYield(extracted.recipeYield));
  const [prepTime, setPrepTime] = useState<number | null>(parsePrepMinutes(extracted.prepTime));
  const totalGrams = yieldWeightGrams(extracted.recipeYield);
  const [ingredients, setIngredients] = useState<PickedIngredient[]>([]);
  const [steps, setSteps] = useState<RecipeFormStep[]>(
    extracted.recipeInstructions.map((s) => ({ title: s.title ?? '', text: s.text })),
  );
  const [sourceAuthor, setSourceAuthor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<MatchOutcome[] | null>(null);
  const [matching, setMatching] = useState(false);

  async function autoMatch() {
    setMatching(true);
    setError(null);
    try {
      const localIngredients: Ingredient[] = await fetch('/api/ingredients').then((r) => r.json());
      const results = await autoMatchIngredients(extracted.recipeIngredient, localIngredients, {
        searchOff: (q) => fetch(`/api/ingredients/lookup?q=${encodeURIComponent(q)}`).then((r) => r.json()),
      });

      const picked: PickedIngredient[] = [];
      const rows: MatchOutcome[] = [];
      for (const r of results) {
        let ingredient = r.ingredient;
        let status: MatchStatus = 'matched';
        const toCreate = r.offCandidate ?? r.fallbackCandidate;
        if (!ingredient && toCreate) {
          const created = await fetch('/api/ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toCreate),
          });
          if (created.ok) {
            ingredient = await created.json();
            status = 'created';
          }
        }
        if (!ingredient) {
          rows.push({ status: 'unmatched', ingredientName: null });
          continue;
        }
        rows.push({ status, ingredientName: ingredient.name });
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
      setOutcomes(rows);
    } catch {
      setError('Nie udało się dopasować składników. Spróbuj ponownie albo dodaj je ręcznie.');
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        servings_base: servings,
        prep_time_min: prepTime,
        source_url: sourceUrl || null,
        source_author: sourceAuthor.trim() || null,
        visibility: 'household',
        diet_tags: [],
        allergens: [],
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
    if (!res.ok) {
      setError(
        res.status === 401
          ? 'Sesja wygasła. Zaloguj się ponownie.'
          : 'Nie udało się zapisać przepisu. Sprawdź dane i spróbuj ponownie.',
      );
      return;
    }
    const r = await res.json();
    onSaved(r.id);
  }

  const counts = outcomes && {
    matched: outcomes.filter((o) => o.status === 'matched').length,
    created: outcomes.filter((o) => o.status === 'created').length,
    unmatched: outcomes.filter((o) => o.status === 'unmatched').length,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:px-8 lg:pt-8">
      <header>
        <h1 className="font-display text-[26px] font-extrabold tracking-tight lg:text-4xl">Sprawdź import</h1>
        <p className="mt-1 text-sm text-muted">
          Sprawdź i uzupełnij dane z importu. Lista składników wymaga mapowania na bazę.
        </p>
      </header>

      <section aria-labelledby="review-details" className="space-y-3">
        <h2 id="review-details" className="sr-only">
          Dane przepisu
        </h2>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Nazwa przepisu</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Autor przepisu</span>
          <Input
            value={sourceAuthor}
            onChange={(e) => setSourceAuthor(e.target.value)}
            placeholder="np. Ania Gotuje"
            maxLength={200}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted">Porcje</span>
            <Input
              type="number"
              inputMode="numeric"
              value={servings}
              min={1}
              onChange={(e) => setServings(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Czas (min)</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={prepTime ?? ''}
              onChange={(e) => setPrepTime(e.target.value === '' ? null : Number(e.target.value))}
            />
          </label>
        </div>
        {totalGrams !== null && servings >= 1 && (
          <p className="text-sm text-muted">
            Przepis podaje wagę ({totalGrams} g) — porcja ok. {Math.round(totalGrams / servings)} g. Popraw liczbę
            porcji, jeśli to nie pasuje.
          </p>
        )}
      </section>

      <section aria-labelledby="review-ingredients" className="space-y-3 border-t border-line pt-4">
        <h2 id="review-ingredients" className="font-display text-lg font-semibold">
          Składniki z importu ({extracted.recipeIngredient.length})
        </h2>
        <ul className="divide-y divide-line border-y border-line text-sm">
          {extracted.recipeIngredient.map((x, i) => {
            const outcome = outcomes?.[i];
            return (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <span>
                  <span className="tabular-nums">{[x.amount, x.unit].filter((p) => p != null).join(' ')}</span> {x.name}
                  {outcome?.ingredientName && outcome.ingredientName.toLowerCase() !== x.name.trim().toLowerCase() && (
                    <span className="block text-xs text-muted">→ {outcome.ingredientName}</span>
                  )}
                </span>
                {outcome && (
                  <Tag className={outcome.status === 'unmatched' ? 'border-ink text-ink' : undefined}>
                    {STATUS_LABEL[outcome.status]}
                  </Tag>
                )}
              </li>
            );
          })}
        </ul>
        {/* One run only: a second run would create the OFF/placeholder ingredients again. */}
        {!outcomes && (
          <Button onClick={autoMatch} disabled={matching} className="w-full sm:w-auto">
            {matching ? 'Dopasowuję…' : 'Auto-mapuj składniki'}
          </Button>
        )}
        {counts && (
          <p role="status" className="text-sm text-muted">
            Dopasowano: {counts.matched} · utworzono: {counts.created} · bez dopasowania: {counts.unmatched}
          </p>
        )}
        <p className="text-sm text-muted">Składniki w przepisie (zmapowane na bazę):</p>
        <IngredientPicker value={ingredients} onChange={setIngredients} />
      </section>

      <section aria-labelledby="review-steps" className="border-t border-line pt-4">
        <h2 id="review-steps" className="mb-3 font-display text-lg font-semibold">
          Kroki
        </h2>
        <StepsEditor value={steps} onChange={setSteps} />
      </section>

      {error && (
        <p role="alert" className="rounded-control border border-brand px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2 pb-4">
        <Button onClick={onCancel} className="flex-1 lg:flex-none">
          Anuluj
        </Button>
        <Button variant="primary" onClick={save} className="flex-1 lg:flex-none">
          Zapisz przepis
        </Button>
      </div>
    </div>
  );
}
