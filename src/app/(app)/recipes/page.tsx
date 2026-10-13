import { Suspense } from 'react';
import { RecipeList } from '@/components/recipes/RecipeList';
import { ButtonLink } from '@/components/ui';
export default function RecipesPage() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h1 className="text-2xl font-bold">Przepisy</h1>
        <ButtonLink href="/recipes/new?import=1">Importuj z URL</ButtonLink>
      </div>
      <Suspense>
        <RecipeList />
      </Suspense>
    </div>
  );
}
