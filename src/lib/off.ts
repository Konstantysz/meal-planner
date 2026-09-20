import type { IngredientInput } from './schemas';
import type { IngredientCategory } from './types';

export interface OffProduct {
  product_name?: string;
  nutriments?: Record<string, number | undefined>;
  categories_tags?: string[];
}

const OFF_BASE = 'https://world.openfoodfacts.org';

export function mapOffProduct(p: OffProduct): IngredientInput | null {
  if (!p.product_name) return null;
  const n = p.nutriments ?? {};
  const kcal = n['energy-kcal_100g'];
  const protein = n.proteins_100g;
  const fat = n.fat_100g;
  const carbs = n.carbohydrates_100g;
  if (kcal == null && protein == null && fat == null && carbs == null) return null;
  return {
    name: p.product_name.trim(),
    category: guessCategory(p.categories_tags ?? []),
    kcal_per_100g: kcal ?? null,
    protein_per_100g: protein ?? null,
    fat_per_100g: fat ?? null,
    carbs_per_100g: carbs ?? null,
    default_unit: 'g',
    source: 'off',
  };
}

function guessCategory(tags: string[]): IngredientCategory {
  const t = tags.join(' ').toLowerCase();
  if (t.includes('vegetable')) return 'warzywa';
  if (t.includes('fruit')) return 'owoce';
  if (t.includes('meat')) return 'mieso';
  if (t.includes('fish') || t.includes('seafood')) return 'ryby';
  if (t.includes('dairy') || t.includes('milk')) return 'nabial';
  if (t.includes('bread')) return 'pieczywo';
  if (t.includes('pasta')) return 'makarony';
  if (t.includes('spice') || t.includes('condiment')) return 'przyprawy';
  if (t.includes('oil') || t.includes('fat')) return 'tluszcze';
  if (t.includes('beverage') || t.includes('drink')) return 'napoje';
  return 'inne';
}

export async function searchOff(query: string): Promise<IngredientInput[]> {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,nutriments,categories_tags`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MealPlanner/1.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  const products: OffProduct[] = data.products ?? [];
  return products.map(mapOffProduct).filter((x): x is IngredientInput => x !== null);
}
