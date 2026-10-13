'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { RecipeListItem } from '@/lib/db/recipes';
import { Button, ButtonLink, EmptyState } from '@/components/ui';
import { RecipeCard } from './RecipeCard';
import { RecipeFilters } from './RecipeFilters';

export const SHELF = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5';

/** Placeholder covers while the list loads (also the Suspense fallback of the page). */
export function RecipeListSkeleton() {
  return (
    <div role="status" aria-busy="true" className={`${SHELF} p-4 lg:px-8`}>
      <span className="sr-only">Ładuję przepisy…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} aria-hidden="true" className="aspect-[3/5] rounded-block bg-hover motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

export function RecipeList() {
  const q = (useSearchParams().get('q') ?? '').trim().toLowerCase();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [diet, setDiet] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const visible = recipes.filter((r) => r.name.toLowerCase().includes(q));
  const filtered = diet.length > 0 || exclude.length > 0;

  useEffect(() => {
    const params = new URLSearchParams();
    diet.forEach((d) => params.append('diet', d));
    exclude.forEach((e) => params.append('exclude', e));
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(`/api/recipes?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((body: unknown) => {
        if (!Array.isArray(body)) throw new Error('unexpected response');
        setRecipes(body as RecipeListItem[]);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailed(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [diet, exclude, attempt]);

  function clearFilters() {
    setDiet([]);
    setExclude([]);
  }

  return (
    <div>
      <RecipeFilters diet={diet} exclude={exclude} onDiet={setDiet} onExclude={setExclude} />
      <div className="p-4 lg:px-8">
        {loading && <RecipeListSkeleton />}
        {!loading && failed && (
          <EmptyState
            message="Nie udało się wczytać przepisów."
            action={<Button onClick={() => setAttempt((n) => n + 1)}>Spróbuj ponownie</Button>}
          />
        )}
        {!loading && !failed && recipes.length === 0 && (
          <EmptyState
            message={filtered ? 'Żaden przepis nie spełnia wybranych filtrów.' : 'Nie masz jeszcze przepisów.'}
            action={
              filtered ? (
                <Button onClick={clearFilters}>Wyczyść filtry</Button>
              ) : (
                <ButtonLink href="/recipes/new">Dodaj pierwszy przepis</ButtonLink>
              )
            }
          />
        )}
        {!loading && !failed && recipes.length > 0 && visible.length === 0 && (
          <EmptyState message={`Brak przepisów pasujących do „${q}”.`} />
        )}
        {!loading && !failed && visible.length > 0 && (
          <ul className={SHELF}>
            {visible.map((r) => (
              <li key={r.id}>
                <RecipeCard recipe={r} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
