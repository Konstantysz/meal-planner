import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RecipeWithDetails } from '@/lib/db/recipes';

// Round trip: stored recipe -> edit form -> PUT route -> updateRecipe -> RPC -> stored recipe -> edit form.
// The database is an in-memory fake of update_recipe (the SQL itself is covered by
// supabase/checks/0009_update_recipe_rpc.verify.sql, which a human runs).
const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

let stored: RecipeWithDetails;
const rpc = vi.fn(async (_fn: string, args: { p_recipe_id: string; p_recipe: Record<string, unknown> }) => {
  const r = args.p_recipe as {
    ingredients: Array<Record<string, unknown>>;
    steps: Array<{ position: number; title: string | null; text: string }>;
  };
  stored = {
    ...stored,
    ...(r as object),
    ingredients: r.ingredients.map((i, n) => ({ id: `ri${n}`, ingredients: null, ...i })),
    steps: r.steps.map((s, n) => ({ id: `s${n}`, ...s })),
  } as unknown as RecipeWithDetails;
  return { data: { id: args.p_recipe_id }, error: null };
});
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, rpc }),
}));

const { PUT } = await import('@/app/api/recipes/[id]/route');
const { RecipeForm } = await import('@/components/recipes/RecipeForm');
const { recipeToFormValues } = await import('@/components/recipes/form-values');

const ING = '3422d8ca-8907-49c2-8c83-da5fc298948f';
const original = {
  id: 'r1',
  household_id: 'h1',
  author_id: 'u1',
  name: 'Zupa',
  servings_base: 4,
  prep_time_min: 30,
  source_url: 'https://a.pl/zupa',
  source_author: 'Ania Gotuje',
  image_url: 'https://cdn.aniagotuje.com/pictures/a.jpg',
  visibility: 'household',
  diet_tags: ['wegetarianska'],
  allergens: ['gluten'],
  created_at: '2026-10-01',
  ingredients: [
    {
      id: 'ri0',
      ingredient_id: ING,
      amount: 100,
      unit: 'g',
      raw_text: 'marchew',
      position: 0,
      optional: false,
      ingredients: null,
    },
    {
      id: 'ri1',
      ingredient_id: ING,
      amount: null,
      unit: null,
      raw_text: 'sól',
      position: 1,
      optional: true,
      ingredients: null,
    },
  ],
  steps: [
    { id: 's0', position: 0, title: 'Przygotuj', text: 'Pokrój marchew.' },
    { id: 's1', position: 1, title: null, text: 'Gotuj.' },
  ],
} as unknown as RecipeWithDetails;

beforeEach(() => {
  stored = structuredClone(original);
  rpc.mockClear();
  router.push.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/ingredients') return new Response('[]');
      return PUT(new Request('http://x' + url, init), { params: Promise.resolve({ id: 'r1' }) });
    }),
  );
});

const renderEdit = () => render(<RecipeForm initialValues={recipeToFormValues(stored)} recipeId="r1" />);

describe('edit round trip', () => {
  it('saving an untouched form reloads identical content', async () => {
    const before = recipeToFormValues(stored);
    renderEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/recipes/r1'));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(recipeToFormValues(stored)).toEqual(before);
  });

  it('saves edited author, step title, reordered steps and a removed ingredient, and reloads them', async () => {
    renderEdit();
    const author = screen.getByLabelText('Autor przepisu');
    await userEvent.clear(author);
    await userEvent.type(author, 'Jadłonomia');
    await userEvent.type(screen.getByLabelText('Tytuł kroku 2'), 'Gotowanie');
    await userEvent.click(screen.getByRole('button', { name: 'Przesuń krok 2 w górę' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Usuń składnik' })[0]);
    await userEvent.click(screen.getByRole('button', { name: '+ krok' }));
    await userEvent.type(screen.getByLabelText('Treść kroku 3'), 'Podaj.');
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());

    const reloaded = recipeToFormValues(stored);
    expect(reloaded.source_author).toBe('Jadłonomia');
    expect(reloaded.steps).toEqual([
      { title: 'Gotowanie', text: 'Gotuj.' },
      { title: 'Przygotuj', text: 'Pokrój marchew.' },
      { title: '', text: 'Podaj.' },
    ]);
    expect(reloaded.ingredients.map((i) => [i.raw_text, i.position])).toEqual([['sól', 0]]);
    expect(reloaded.source_url).toBe('https://a.pl/zupa');
  });

  it('shows the error and stays on the page when the update is refused', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'recipe not found or not editable' },
    } as never);
    renderEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('brak dostępu do przepisu');
    expect(router.push).not.toHaveBeenCalled();
  });
});
