import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RecipeListItem } from '@/lib/db/recipes';

const router = { push: vi.fn(), refresh: vi.fn() };
let search = '';
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(search) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { RecipeCard } = await import('@/components/recipes/RecipeCard');
const { RecipeList } = await import('@/components/recipes/RecipeList');
const { StepCards } = await import('@/components/recipes/StepCards');
const { ScalableIngredients } = await import('@/components/recipes/ScalableIngredients');
const { RecipeForm } = await import('@/components/recipes/RecipeForm');

const recipe: RecipeListItem = {
  id: 'r1',
  household_id: 'h',
  author_id: 'u',
  name: 'Zupa pomidorowa',
  servings_base: 4,
  prep_time_min: 30,
  source_url: null,
  source_author: 'Ania Gotuje',
  visibility: 'household',
  diet_tags: ['wegetarianska'],
  allergens: ['gluten'],
  created_at: '2026-10-01',
  macros_per_serving: { kcal: 250, protein: 10, fat: 5.5, carbs: 40 },
  cover_position: 2,
};

describe('RecipeCard', () => {
  it('shows name, author, servings, time, chips and macros per serving', () => {
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/recipes/r1');
    expect(screen.getByRole('heading', { name: 'Zupa pomidorowa' })).toBeInTheDocument();
    expect(screen.getByText('Ania Gotuje ·')).toBeInTheDocument();
    expect(screen.getByText(/4 porcji/)).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('wegetariańska')).toBeInTheDocument();
    expect(screen.getByText('zawiera: gluten')).toBeInTheDocument();
    expect(screen.getByText(/250 kcal/)).toBeInTheDocument();
  });

  it('falls back gracefully without author, time, chips and macros', () => {
    render(
      <RecipeCard
        recipe={{
          ...recipe,
          source_author: null,
          prep_time_min: null,
          diet_tags: [],
          allergens: [],
          macros_per_serving: null,
          cover_position: null,
        }}
      />,
    );
    expect(screen.getByText('brak danych makro')).toBeInTheDocument();
    expect(screen.queryByText(/min$/)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('RecipeList states', () => {
  beforeEach(() => {
    search = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(impl: () => Promise<Partial<Response>>) {
    vi.stubGlobal('fetch', vi.fn(impl));
  }
  const ok = (data: unknown) => () => Promise.resolve({ ok: true, json: async () => data });

  it('shows a loading status, then the cards', async () => {
    stubFetch(ok([recipe]));
    render(<RecipeList />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('heading', { name: 'Zupa pomidorowa' })).toBeInTheDocument();
  });

  it('shows an empty state with one action when there are no recipes', async () => {
    stubFetch(ok([]));
    render(<RecipeList />);
    expect(await screen.findByText('Nie masz jeszcze przepisów.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dodaj pierwszy przepis' })).toHaveAttribute('href', '/recipes/new');
  });

  it('says so when the search matches nothing', async () => {
    search = 'q=kotlet';
    stubFetch(ok([recipe]));
    render(<RecipeList />);
    expect(await screen.findByText('Brak przepisów pasujących do „kotlet”.')).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    stubFetch(() => Promise.resolve({ ok: false, json: async () => ({ error: 'x' }) }));
    render(<RecipeList />);
    expect(await screen.findByText('Nie udało się wczytać przepisów.')).toBeInTheDocument();
    stubFetch(ok([recipe]));
    await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByRole('heading', { name: 'Zupa pomidorowa' })).toBeInTheDocument();
  });

  it('offers to clear filters when they leave nothing', async () => {
    stubFetch(ok([]));
    render(<RecipeList />);
    await screen.findByText('Nie masz jeszcze przepisów.');
    await userEvent.click(screen.getByRole('button', { name: 'wegetariańska' }));
    expect(await screen.findByText('Żaden przepis nie spełnia wybranych filtrów.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Wyczyść filtry' }));
    expect(await screen.findByText('Nie masz jeszcze przepisów.')).toBeInTheDocument();
  });
});

describe('StepCards', () => {
  const steps = [
    { id: 's1', title: 'Przygotuj', text: 'Pokrój cebulę.' },
    { id: 's2', title: 'Smaż', text: 'Smaż 5 minut.' },
    { id: 's3', title: null, text: 'Podawaj gorące.' },
  ];

  it('expands only the first step and renders an untitled step as a plain numbered card', () => {
    const { container } = render(<StepCards steps={steps} />);
    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(2);
    expect(details[0]).toHaveProperty('open', true);
    expect(details[1]).toHaveProperty('open', false);
    const plain = screen.getByText('Podawaj gorące.').closest('li')!;
    expect(plain.querySelector('details')).toBeNull();
    expect(within(plain).getByText('3.')).toBeInTheDocument();
  });

  it('toggles a step with its summary and all steps with the control', async () => {
    const { container } = render(<StepCards steps={steps} />);
    const details = container.querySelectorAll('details');
    await userEvent.click(screen.getByText('Smaż'));
    await waitFor(() => expect(details[1]).toHaveProperty('open', true));

    await userEvent.click(screen.getByRole('button', { name: 'Zwiń wszystkie' }));
    await waitFor(() => expect(details[0]).toHaveProperty('open', false));
    await userEvent.click(screen.getByRole('button', { name: 'Rozwiń wszystkie' }));
    await waitFor(() => expect(details[1]).toHaveProperty('open', true));
    expect(details[0]).toHaveProperty('open', true);
  });

  it('has no expand control when no step has a title', () => {
    render(<StepCards steps={[{ id: 'a', title: null, text: 'Jedno.' }]} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Jedno.')).toBeInTheDocument();
  });
});

describe('ScalableIngredients', () => {
  const lines = [
    { id: 'i1', amount: 200, unit: 'g', raw_text: 'mąka', optional: false },
    { id: 'i2', amount: null, unit: null, raw_text: 'sól', optional: true },
  ];

  it('scales amounts with the servings stepper and restores the original', async () => {
    render(<ScalableIngredients lines={lines} baseServings={2} />);
    expect(screen.getByText(/200 g/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Więcej porcji' }));
    expect(screen.getByText('3 porcji')).toBeInTheDocument();
    expect(screen.getByText(/300 g/)).toBeInTheDocument();
    expect(screen.getByText('(opcjonalnie)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Przywróć' }));
    expect(screen.getByText(/200 g/)).toBeInTheDocument();
  });

  it('does not go below one serving', async () => {
    render(<ScalableIngredients lines={lines} baseServings={1} />);
    expect(screen.getByRole('button', { name: 'Mniej porcji' })).toBeDisabled();
  });
});

describe('RecipeForm validation messages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows field-level Polish messages instead of raw Zod JSON, without calling the API', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<RecipeForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
    expect(await screen.findByText('Podaj nazwę przepisu (do 200 znaków).')).toBeInTheDocument();
    expect(screen.getByText('Dodaj co najmniej jeden składnik.')).toBeInTheDocument();
    expect(screen.getByText('Dodaj co najmniej jeden krok z treścią.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwa przepisu')).toHaveAttribute('aria-invalid', 'true');
    expect(document.body.textContent).not.toMatch(/too_small|ZodError/);
    expect(fetchMock).not.toHaveBeenCalledWith('/api/recipes', expect.anything());
  });

  it('maps server-side issues to fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/ingredients'
          ? { ok: true, json: async () => [] }
          : {
              ok: false,
              json: async () => ({ error: 'ZodError: ...', issues: [{ path: ['name'], code: 'too_small' }] }),
            },
      ),
    );
    render(
      <RecipeForm
        initialValues={{
          name: 'Zupa',
          servings_base: 2,
          prep_time_min: null,
          diet_tags: [],
          allergens: [],
          ingredients: [
            {
              ingredient_id: '3422d8ca-8907-49c2-8c83-da5fc298948f',
              ingredient_name: 'mąka',
              amount: 1,
              unit: 'g',
              raw_text: 'mąka',
              position: 0,
              optional: false,
            },
          ],
          steps: [{ title: '', text: 'Gotuj.' }],
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
    expect(await screen.findByText('Podaj nazwę przepisu (do 200 znaków).')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ZodError/);
  });
});
