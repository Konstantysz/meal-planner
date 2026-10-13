import { Suspense } from 'react';
import { RecipeList } from '@/components/recipes/RecipeList';
export default function RecipesPage() {
  return (
    <div>
      <h1 className="p-4 font-display text-3xl font-extrabold">Przepisy</h1>
      <Suspense>
        <RecipeList />
      </Suspense>
    </div>
  );
}
