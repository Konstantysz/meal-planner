'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { RecipeListItem } from '@/lib/db/recipes';
import { ButtonLink, EmptyState } from '@/components/ui';
import { RecipeCard } from './RecipeCard';
import { RecipeFilters } from './RecipeFilters';

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

/** Placeholder covers while the list loads; same grid, so nothing jumps when the cards arrive. */
function Skeleton() {
  return (
    <div className={GRID} role="status" aria-label="Ładuję przepisy">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="aspect-[3/4] rounded-block bg-hover motion-safe:animate-pulse" />
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

  const visible = recipes.filter((r) => r.name.toLowerCase().includes(q));
  const filtered = diet.length > 0 || exclude.length > 0;

  useEffect(() => {
    const params = new URLSearchParams();
    diet.forEach((d) => params.append('diet', d));
    exclude.forEach((e) => params.append('exclude', e));
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(`/api/recipes?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const data: RecipeListItem[] = await r.json();
        if (!ctrl.signal.aborted) setRecipes(data);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [diet, exclude]);

  return (
    <div>
      <RecipeFilters diet={diet} exclude={exclude} onDiet={setDiet} onExclude={setExclude} />
      <div className="p-4">
        {loading && <Skeleton />}
        {!loading && failed && <EmptyState message="Nie udało się wczytać przepisów. Odśwież stronę." />}
        {!loading && !failed && recipes.length === 0 && (
          <EmptyState
            message={filtered ? 'Brak przepisów dla wybranych filtrów.' : 'Brak przepisów. Dodaj pierwszy.'}
            action={
              <ButtonLink variant="primary" href="/recipes/new">
                Dodaj przepis
              </ButtonLink>
            }
          />
        )}
        {!loading && !failed && recipes.length > 0 && visible.length === 0 && (
          <EmptyState message={`Brak przepisów pasujących do „${q}”.`} />
        )}
        {!loading && !failed && visible.length > 0 && (
          <div className={GRID}>
            {visible.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </div>
      {recipes.length > 0 && (
        <ButtonLink variant="primary" href="/recipes/new" className="fixed bottom-20 right-4 lg:bottom-6">
          + Nowy przepis
        </ButtonLink>
      )}
    </div>
  );
}
