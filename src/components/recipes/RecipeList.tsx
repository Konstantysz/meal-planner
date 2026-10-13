'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Recipe } from '@/lib/types';
import { RecipeCard } from './RecipeCard';
import { RecipeFilters } from './RecipeFilters';

export function RecipeList() {
  const q = (useSearchParams().get('q') ?? '').trim().toLowerCase();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [diet, setDiet] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const visible = recipes.filter((r) => r.name.toLowerCase().includes(q));

  useEffect(() => {
    const params = new URLSearchParams();
    diet.forEach((d) => params.append('diet', d));
    exclude.forEach((e) => params.append('exclude', e));
    setLoading(true);
    fetch(`/api/recipes?${params}`)
      .then((r) => r.json())
      .then(setRecipes)
      .finally(() => setLoading(false));
  }, [diet, exclude]);

  return (
    <div>
      <RecipeFilters diet={diet} exclude={exclude} onDiet={setDiet} onExclude={setExclude} />
      <div className="p-4 space-y-2">
        {loading && <p className="text-muted">Ładuję…</p>}
        {!loading && recipes.length === 0 && <p className="text-muted">Brak przepisów. Dodaj pierwszy.</p>}
        {!loading && recipes.length > 0 && visible.length === 0 && (
          <p className="text-muted">Brak przepisów pasujących do „{q}”.</p>
        )}
        {visible.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
      <Link
        href="/recipes/new"
        className="fixed bottom-20 right-4 lg:bottom-6 bg-brand text-on-brand rounded-control min-h-11 px-4 flex items-center justify-center font-medium"
      >
        + Nowy przepis
      </Link>
    </div>
  );
}
