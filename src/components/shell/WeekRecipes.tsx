'use client';
import Link from 'next/link';
import { usePlan } from '@/hooks/usePlan';
import { weekStartOf } from '@/lib/week';

/** Recipes planned this week, for the desktop sidebar. */
export function WeekRecipes() {
  const { plan } = usePlan(weekStartOf(new Date()));
  const recipes = new Map<string, string>();
  for (const s of plan?.slots ?? []) if (s.recipe) recipes.set(s.recipe.id, s.recipe.name);
  if (recipes.size === 0) return null;
  return (
    <section aria-labelledby="week-recipes" className="mt-6">
      <h2 id="week-recipes" className="mb-2 px-3 text-xs font-medium text-muted">
        W tym tygodniu
      </h2>
      <ul>
        {[...recipes].map(([id, name]) => (
          <li key={id}>
            <Link href={`/recipes/${id}`} className="block rounded-control px-3 py-1.5 text-sm hover:bg-hover">
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
