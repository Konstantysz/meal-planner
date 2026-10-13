'use client';
import { useState } from 'react';
import { Button, Icon, Input } from '@/components/ui';
import type { ExtractedIngredient, ExtractedRecipe } from '@/lib/import/schema';
import type { Ingredient } from '@/lib/types';
import { IngredientPicker, type PickedIngredient } from '@/components/recipes/IngredientPicker';
import { StepsEditor, type EditableStep } from '@/components/recipes/StepsEditor';
import { ExtractedIngredientsEditor } from './ExtractedIngredientsEditor';
import { isSessionRedirect, saveStatusMessage } from '@/lib/import/errors';
import { autoMatchIngredients } from '@/lib/import/auto-match';
import { parsePrepMinutes } from '@/lib/import/duration';
import {
  MATCH_STATUS_LABEL,
  summarizeOutcome,
  type MatchOutcomeRow,
  type MatchStatus,
} from '@/lib/import/match-outcome';
import { normalizeUnit } from '@/lib/import/unit';
import { parseYield, yieldWeightGrams } from '@/lib/import/yield';
import { positiveAmountOrNull } from '@/lib/scaling';

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
  const [outcome, setOutcome] = useState<MatchOutcomeRow[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [saving, setSaving] = useState(false);

  async function autoMatch() {
    setMatching(true);
    setError(null);
    setOutcome(null);
    try {
      const localIngredients: Ingredient[] = await fetch('/api/ingredients').then((r) => r.json());
      const toMatch = rows
        .filter((r) => r.name.trim())
        .map((r) => ({ ...r, unit: r.unit ? (normalizeUnit(r.unit.trim()) ?? r.unit.trim()) : null }));
      const results = await autoMatchIngredients(toMatch, localIngredients, {
        searchOff: (q) => fetch(`/api/ingredients/lookup?q=${encodeURIComponent(q)}`).then((r) => r.json()),
      });

      const picked: PickedIngredient[] = [];
      const report: MatchOutcomeRow[] = [];
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
          report.push({ text: r.raw_text, status: 'unmatched', ingredientName: null });
          continue;
        }
        report.push({ text: r.raw_text, status, ingredientName: ingredient.name });
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
      setOutcome(report);
    } catch {
      setError('Nie udało się dopasować składników. Sprawdź połączenie i spróbuj ponownie.');
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
    setSaving(true);
    try {
      await post(cleanSteps);
    } catch {
      setError('Nie udało się zapisać przepisu. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  async function post(cleanSteps: EditableStep[]) {
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
          amount: positiveAmountOrNull(i.amount),
          unit: i.unit,
          raw_text: i.raw_text,
          position: i.position,
          optional: i.optional,
        })),
        steps: cleanSteps.map((s, i) => ({ position: i, title: s.title.trim() || null, text: s.text })),
      }),
    });
    if (!res.ok) {
      // POST /api/recipes answers an invalid body with `{ error, fields }`: show one message per field.
      const body: unknown = res.status === 400 ? await res.json().catch(() => null) : null;
      const { fields } = (body ?? {}) as { fields?: Record<string, unknown> };
      const detail = Object.values(fields ?? {}).filter((m): m is string => typeof m === 'string');
      setError(detail.length > 0 ? detail.join('. ') : saveStatusMessage(res.status));
      return;
    }
    // An expired session redirects to /login, which fetch follows into an HTML 200.
    if (isSessionRedirect(res)) {
      setError(saveStatusMessage(401));
      return;
    }
    const r = await res.json();
    onSaved(r.id);
  }

  const sourceHost = hostOf(sourceUrl);
  const counts = outcome ? summarizeOutcome(outcome) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 pt-4">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Sprawdź import</h1>
        {sourceHost && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Icon name="link" className="size-4 shrink-0 text-faint" />
            <span className="min-w-0 truncate">{sourceHost}</span>
          </p>
        )}
        <p className="text-muted">Sprawdź i uzupełnij dane z importu. Lista składników wymaga mapowania na bazę.</p>
      </header>

      <section className="space-y-4">
        <Input
          aria-label="Nazwa przepisu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="font-display text-xl font-semibold lg:text-xl"
        />
        <label className="block space-y-1">
          <span className="text-sm text-muted">Zdjęcie (adres URL)</span>
          <Input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
            maxLength={2048}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted">Porcje</span>
            <Input
              type="number"
              value={servings}
              min={1}
              inputMode="numeric"
              onChange={(e) => setServings(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">Czas (min)</span>
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={prepTime ?? ''}
              onChange={(e) =>
                setPrepTime(e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))
              }
            />
          </label>
        </div>
        {totalGrams !== null && servings >= 1 && (
          <p className="text-sm text-muted">
            Przepis podaje wagę ({totalGrams} g) — porcja ok. {Math.round(totalGrams / servings)} g. Popraw liczbę
            porcji, jeśli to nie pasuje.
          </p>
        )}
        <label className="block space-y-1">
          <span className="text-sm text-muted">Autor przepisu</span>
          <Input
            value={sourceAuthor}
            onChange={(e) => setSourceAuthor(e.target.value)}
            placeholder="np. Ania Gotuje"
            maxLength={200}
          />
        </label>
      </section>

      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="font-display text-lg font-semibold">Składniki z importu ({rows.length})</h2>
        <ExtractedIngredientsEditor rows={rows} onChange={setRows} />
        <Button onClick={autoMatch} disabled={matching} className="w-full lg:w-auto">
          {matching ? 'Dopasowuję…' : 'Auto-mapuj składniki'}
        </Button>
        <p role="status" className="text-sm">
          {outcome && counts && (
            <>
              Dopasowane: <span className="tabular-nums">{counts.matched}</span>, nowe:{' '}
              <span className="tabular-nums">{counts.created}</span>, bez dopasowania:{' '}
              <span className="tabular-nums">{counts.unmatched}</span>.
              {counts.created > 0 && ' Sprawdź makra nowych składników.'}
              {counts.unmatched > 0 && ' Uzupełnij je ręcznie poniżej.'}
            </>
          )}
        </p>
        {outcome && (
          <div className="space-y-2">
            <ul aria-label="Wynik dopasowania" className="divide-y divide-line border-y border-line text-sm">
              {outcome.map((o, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{o.text}</span>
                    {o.ingredientName && o.ingredientName !== o.text && (
                      <span className="block truncate text-muted">→ {o.ingredientName}</span>
                    )}
                  </span>
                  <span
                    className={
                      o.status === 'matched'
                        ? 'shrink-0 text-muted'
                        : o.status === 'created'
                          ? 'shrink-0 font-medium text-ink'
                          : 'shrink-0 font-semibold text-ink'
                    }
                  >
                    {MATCH_STATUS_LABEL[o.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="font-display text-lg font-semibold">Składniki w przepisie ({ingredients.length})</h2>
        <p className="text-sm text-muted">Zapisane zostaną tylko te składniki. Dodaj brakujące wyszukiwarką.</p>
        <IngredientPicker value={ingredients} onChange={setIngredients} />
      </section>

      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="font-display text-lg font-semibold">Kroki</h2>
        <StepsEditor steps={steps} onChange={setSteps} />
      </section>

      {error && (
        <p role="alert" className="rounded-control border border-brand px-3 py-2">
          {error}
        </p>
      )}

      <div className="sticky bottom-14 z-40 -mx-4 flex gap-2 border-t border-line bg-background px-4 py-3 lg:bottom-0">
        <Button onClick={onCancel} className="flex-1 lg:flex-none">
          Anuluj
        </Button>
        <Button variant="primary" onClick={save} disabled={saving} className="flex-1 lg:flex-none">
          {saving ? 'Zapisuję…' : 'Zapisz przepis'}
        </Button>
      </div>
    </div>
  );
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
