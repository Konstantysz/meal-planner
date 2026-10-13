import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { RecipeWithDetails } from '@/lib/db/recipes';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), notFound: vi.fn() }));
// The page may also ask who is signed in and whether they are an app admin (fork rules, #98): signed out, no admin.
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    rpc: async () => ({ data: false, error: null }),
  }),
}));

const ingredient = (n: number, name: string, kcal: number | null) => ({
  id: `i${n}`,
  name,
  category: 'inne',
  kcal_per_100g: kcal,
  protein_per_100g: kcal === null ? null : 0,
  fat_per_100g: kcal === null ? null : 0,
  carbs_per_100g: kcal === null ? null : 0,
});
const row = (n: number, name: string, kcal: number | null, amount: number, unit: string, raw_text: string) => ({
  id: `ri${n}`,
  recipe_id: 'r1',
  ingredient_id: `i${n}`,
  amount,
  unit,
  raw_text,
  position: n,
  optional: false,
  ingredients: ingredient(n, name, kcal),
});

let recipe: RecipeWithDetails;
vi.mock('@/lib/db/recipes', () => ({ getRecipe: async () => recipe, getRecipeName: async () => null }));

const { default: RecipePage } = await import('@/app/(app)/recipes/[id]/page');

async function renderRecipe(ingredients: ReturnType<typeof row>[]) {
  recipe = {
    id: 'r1',
    name: 'Kasza z oliwą',
    servings_base: 2,
    prep_time_min: null,
    source_url: null,
    ingredients,
    steps: [],
  } as unknown as RecipeWithDetails;
  render(await RecipePage({ params: Promise.resolve({ id: 'r1' }) }));
}

describe('recipe view macros', () => {
  it('shows „makra niepełne" with the left-out ingredients and labels the total as partial', async () => {
    await renderRecipe([
      row(0, 'kasza', 350, 0.2, 'kg', '200 g kaszy'),
      row(1, 'przyprawa domowa', null, 5, 'g', '5 g przyprawy'),
      row(2, 'oliwa', 900, 2, 'łyżka', '2 łyżki oliwy'),
    ]);
    expect(screen.getByText('makra niepełne')).toBeTruthy();
    expect(screen.getByText('Makro per porcja (co najmniej):')).toBeTruthy();
    expect(screen.getByText(/^350 kcal/)).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Składniki pominięte w makro' });
    const items = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      'przyprawa domowa (brak makro składnika)',
      'oliwa (jednostki nie da się przeliczyć na gramy)',
    ]);
  });

  it('shows a complete total without the badge', async () => {
    await renderRecipe([row(0, 'kasza', 350, 0.2, 'kg', '200 g kaszy'), row(1, 'oliwa', 900, 2, 'cl', '20 ml oliwy')]);
    expect(screen.queryByText('makra niepełne')).toBeNull();
    expect(screen.getByText('Makro per porcja:')).toBeTruthy();
    expect(screen.getByText(/^440 kcal/)).toBeTruthy();
  });
});
