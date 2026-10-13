import { Suspense } from 'react';
import { RecipeList, RecipeListSkeleton } from '@/components/recipes/RecipeList';
import { ButtonLink } from '@/components/ui';

export default function RecipesPage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 p-4 lg:px-8 lg:pt-8">
        <h1 className="font-display text-[26px] font-extrabold tracking-tight lg:text-4xl">Przepisy</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink href="/recipes/new?import=1">Import z URL</ButtonLink>
          <ButtonLink href="/recipes/new" variant="primary">
            Nowy przepis
          </ButtonLink>
        </div>
      </div>
      <Suspense fallback={<RecipeListSkeleton />}>
        <RecipeList />
      </Suspense>
    </div>
  );
}
