import Link from 'next/link';
import type { Recipe } from '@/lib/types';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link href={`/recipes/${recipe.id}`}
      className="block border rounded-lg p-4 hover:bg-gray-50">
      <h3 className="font-semibold">{recipe.name}</h3>
      <p className="text-xs text-gray-500 mt-1">
        {recipe.servings_base} porcji
        {recipe.prep_time_min != null && ` · ${recipe.prep_time_min} min`}
      </p>
      {recipe.diet_tags.length > 0 && (
        <div className="mt-2 flex gap-1 flex-wrap">
          {recipe.diet_tags.map((t) => (
            <span key={t} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </Link>
  );
}
