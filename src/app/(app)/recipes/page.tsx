import { Suspense } from 'react';
import { RecipeList } from '@/components/recipes/RecipeList';
export default function RecipesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold p-4">Przepisy</h1>
      <Suspense>
        <RecipeList />
      </Suspense>
    </div>
  );
}
