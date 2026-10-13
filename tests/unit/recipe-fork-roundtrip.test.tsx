import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RecipeWithDetails } from '@/lib/db/recipes';

// Round trip for a member editing another member's recipe:
// detail page "Edytuj" -> fork route -> forkRecipe -> fork_recipe -> edit form on the fork -> PUT route
// -> updateRecipe -> update_recipe. The database is an in-memory fake that enforces the 0014 rule
// (only the author edits); the SQL itself is covered by supabase/checks/0014_recipe_fork.verify.sql.
const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const ME = 'u2'; // household member, not the author of r1
const FORK = '0b6f3f4e-1f7e-4a53-9f43-2b8d0e8f6a11';
let db: Map<string, RecipeWithDetails>;

type RpcArgs = { p_recipe_id: string; p_recipe?: Record<string, unknown> };
const rpc = vi.fn(async (fn: string, args: RpcArgs) => {
  const rec = db.get(args.p_recipe_id);
  if (fn === 'fork_recipe') {
    if (!rec) return { data: null, error: { code: 'P0002', message: 'recipe not found' } };
    // Like fork_recipe: the caller's existing fork of this source is returned, not duplicated.
    const existing = [...db.values()].find((r) => r.forked_from_id === rec.id && r.author_id === ME);
    if (existing) return { data: existing.id, error: null };
    db.set(FORK, {
      ...structuredClone(rec),
      id: FORK,
      name: `${rec.name} (kopia)`,
      author_id: ME,
      forked_from_id: rec.id,
      ingredients: rec.ingredients.map((i, n) => ({ ...i, id: `fri${n}` })),
      steps: rec.steps.map((s, n) => ({ ...s, id: `fs${n}` })),
    });
    return { data: FORK, error: null };
  }
  if (fn === 'update_recipe') {
    if (!rec || rec.author_id !== ME)
      return { data: null, error: { code: '42501', message: 'recipe not found or not editable' } };
    const r = args.p_recipe as {
      ingredients: Array<Record<string, unknown>>;
      steps: Array<{ position: number; title: string | null; text: string }>;
    };
    db.set(rec.id, {
      ...rec,
      ...(r as object),
      ingredients: r.ingredients.map((i, n) => ({ id: `ri${n}`, ingredients: null, ...i })),
      steps: r.steps.map((s, n) => ({ id: `s${n}`, ...s })),
    } as unknown as RecipeWithDetails);
    return { data: { id: rec.id }, error: null };
  }
  throw new Error(`unexpected rpc ${fn}`);
});
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { getUser: async () => ({ data: { user: { id: ME } } }) }, rpc }),
}));

const { PUT } = await import('@/app/api/recipes/[id]/route');
const { POST: FORK_POST } = await import('@/app/api/recipes/[id]/fork/route');
const { RecipeActions } = await import('@/components/recipes/RecipeActions');
const { RecipeDetail } = await import('@/components/recipes/RecipeDetail');
const { RecipeForm } = await import('@/components/recipes/RecipeForm');
const { recipeToFormValues } = await import('@/components/recipes/form-values');
const { canEditRecipe } = await import('@/lib/recipe-access');

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
  visibility: 'household',
  diet_tags: ['wegetarianska'],
  allergens: ['gluten'],
  forked_from_id: null,
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
  db = new Map([['r1', structuredClone(original)]]);
  rpc.mockClear();
  router.push.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/ingredients') return new Response('[]');
      const m = /^\/api\/recipes\/([^/]+)(\/fork)?$/.exec(url);
      if (!m) throw new Error(`unexpected fetch ${url}`);
      const ctx = { params: Promise.resolve({ id: m[1] }) };
      const req = new Request('http://x' + url, init);
      return m[2] ? FORK_POST(req, ctx) : PUT(req, ctx);
    }),
  );
});

describe('editing another member’s recipe', () => {
  it('forks it, saves the edit on the fork and leaves the original unchanged', async () => {
    const before = recipeToFormValues(db.get('r1')!);
    const canEdit = canEditRecipe(db.get('r1')!, ME, false);
    expect(canEdit).toBe(false);

    render(<RecipeActions recipeId="r1" canEdit={canEdit} />);
    expect(screen.queryByRole('button', { name: 'Usuń' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Edytuj' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/recipes/${FORK}/edit`));
    expect(rpc).toHaveBeenCalledWith('fork_recipe', { p_recipe_id: 'r1' });
    cleanup();

    // The fork's edit page renders the form for the fork, which the member authors.
    const fork = db.get(FORK)!;
    expect(canEditRecipe(fork, ME, false)).toBe(true);
    expect(recipeToFormValues(fork)).toEqual({ ...before, name: 'Zupa (kopia)' });
    render(<RecipeForm initialValues={recipeToFormValues(fork)} recipeId={FORK} />);
    const name = screen.getByLabelText('Nazwa przepisu');
    await userEvent.clear(name);
    await userEvent.type(name, 'Zupa po mojemu');
    await userEvent.type(screen.getByLabelText('Tytuł kroku 2'), 'Gotowanie');
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/recipes/${FORK}`));

    const saved = db.get(FORK)!;
    expect(saved.name).toBe('Zupa po mojemu');
    expect(saved.author_id).toBe(ME);
    expect(saved.forked_from_id).toBe('r1');
    expect(recipeToFormValues(saved).steps[1]).toEqual({ title: 'Gotowanie', text: 'Gotuj.' });
    expect(recipeToFormValues(db.get('r1')!)).toEqual(before);
    expect(db.get('r1')!.author_id).toBe('u1');

    // A second "Edytuj" on the original opens the same fork instead of making another one.
    router.push.mockClear();
    render(<RecipeActions recipeId="r1" canEdit={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edytuj' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/recipes/${FORK}/edit`));
    expect(db.size).toBe(2);
  });

  it('refuses a direct edit of the original with an error and changes nothing', async () => {
    const before = recipeToFormValues(db.get('r1')!);
    render(<RecipeForm initialValues={before} recipeId="r1" />);
    const name = screen.getByLabelText('Nazwa przepisu');
    await userEvent.clear(name);
    await userEvent.type(name, 'Przejęta zupa');
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('brak dostępu do przepisu');
    expect(router.push).not.toHaveBeenCalled();
    expect(recipeToFormValues(db.get('r1')!)).toEqual(before);
  });

  it('shows the error when the fork fails', async () => {
    db.clear();
    render(<RecipeActions recipeId="r1" canEdit={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edytuj' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('przepis nie istnieje');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows an error and re-enables the button when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    render(<RecipeActions recipeId="r1" canEdit={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edytuj' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się utworzyć kopii. Spróbuj ponownie.');
    expect(screen.getByRole('button', { name: 'Edytuj' })).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
    expect(db.size).toBe(1);
  });
});

describe('RecipeDetail for a fork', () => {
  const fork = { ...original, id: FORK, author_id: ME, name: 'Zupa (kopia)', forked_from_id: 'r1', image_url: null };

  it('links to the readable original and edits in place for the author', () => {
    render(<RecipeDetail recipe={fork} canEdit originalName="Zupa" />);
    expect(screen.getByRole('link', { name: '„Zupa”' })).toHaveAttribute('href', '/recipes/r1');
    expect(screen.getByRole('link', { name: 'Edytuj' })).toHaveAttribute('href', `/recipes/${FORK}/edit`);
    expect(screen.getByRole('button', { name: 'Usuń' })).toBeTruthy();
  });

  it('hides the link when the original is not readable and forks for a non-author', () => {
    render(<RecipeDetail recipe={fork} canEdit={false} originalName={null} />);
    expect(screen.queryByText(/Kopia przepisu/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Edytuj' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Usuń' })).toBeNull();
  });
});
