import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/recipes/IngredientPicker', () => ({
  IngredientPicker: ({ onChange }: { onChange: (v: unknown[]) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange([
          {
            ingredient_id: 'i1',
            ingredient_name: 'a',
            amount: 1,
            unit: 'g',
            raw_text: 'a',
            position: 0,
            optional: false,
          },
        ])
      }
    >
      mock-pick
    </button>
  ),
}));

import { ImportReviewForm } from '@/components/import/ImportReviewForm';

const BASE = {
  name: 'Zupa',
  recipeIngredient: [{ name: 'a', amount: 1, unit: 'g', optional: false }],
  recipeInstructions: [{ title: null, text: 'b' }],
};

async function saveWith(extracted: Record<string, unknown>, edit?: string) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'r1' }), { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <ImportReviewForm
      extracted={{ ...BASE, ...extracted } as never}
      sourceUrl="https://a.pl/x"
      onCancel={() => {}}
      onSaved={() => {}}
    />,
  );
  if (edit !== undefined) {
    const field = screen.getByLabelText('Czas (min)');
    await userEvent.clear(field);
    if (edit) await userEvent.type(field, edit);
  }
  await userEvent.click(screen.getByText('mock-pick'));
  await userEvent.click(screen.getByRole('button', { name: /zapisz przepis/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  return JSON.parse(calls[0][1].body as string);
}

afterEach(() => vi.unstubAllGlobals());

describe('ImportReviewForm prep time', () => {
  it('prefills "Czas (min)" from the ISO duration and saves it as prep_time_min', async () => {
    const body = await saveWith({ prepTime: 'PT1H30M' });
    expect(body.prep_time_min).toBe(90);
    expect(screen.getByLabelText('Czas (min)')).toHaveValue(90);
  });

  it('saves the edited value', async () => {
    const body = await saveWith({ prepTime: 'PT20M' }, '35');
    expect(body.prep_time_min).toBe(35);
  });

  it('saves null when absent', async () => {
    expect((await saveWith({})).prep_time_min).toBeNull();
  });

  it('saves null when unparsable', async () => {
    expect((await saveWith({ prepTime: 'sporo' })).prep_time_min).toBeNull();
  });

  it('saves null when cleared', async () => {
    expect((await saveWith({ prepTime: 'PT20M' }, '')).prep_time_min).toBeNull();
  });
});

describe('ImportReviewForm step titles', () => {
  it('sends the title of each step to save_recipe, null when absent', async () => {
    const body = await saveWith({
      recipeInstructions: [
        { title: 'Smażenie cebuli', text: 'Smaż 5 minut.' },
        { title: null, text: 'Gotuj.' },
      ],
    });
    expect(body.steps).toEqual([
      { position: 0, title: 'Smażenie cebuli', text: 'Smaż 5 minut.' },
      { position: 1, title: null, text: 'Gotuj.' },
    ]);
  });

  it('truncates a model-supplied title to 200 characters on prefill', async () => {
    const body = await saveWith({
      recipeInstructions: [{ title: 'x'.repeat(250), text: 'Gotuj.' }],
    });
    expect(body.steps[0].title).toBe('x'.repeat(200));
  });
});

describe('ImportReviewForm step editing', () => {
  async function saveAfter(act: () => Promise<void>, instructions = [{ title: null, text: 'Pierwszy' }]) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'r1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ImportReviewForm
        extracted={{ ...BASE, recipeInstructions: instructions } as never}
        sourceUrl=""
        onCancel={() => {}}
        onSaved={() => {}}
      />,
    );
    await act();
    await userEvent.click(screen.getByText('mock-pick'));
    await userEvent.click(screen.getByRole('button', { name: /zapisz przepis/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    return JSON.parse(calls[0][1].body as string);
  }

  const TWO = [
    { title: null, text: 'A' },
    { title: null, text: 'B' },
  ];

  it('adds a step and drops it on save when it is left empty', async () => {
    const body = await saveAfter(async () => {
      await userEvent.click(screen.getByRole('button', { name: '+ krok' }));
      expect(screen.getByLabelText('Treść kroku 2')).toBeInTheDocument();
    });
    expect(body.steps).toEqual([{ position: 0, title: null, text: 'Pierwszy' }]);
  });

  it('saves a typed new step with its title', async () => {
    const body = await saveAfter(async () => {
      await userEvent.click(screen.getByRole('button', { name: '+ krok' }));
      await userEvent.type(screen.getByLabelText('Tytuł kroku 2'), 'Podanie');
      await userEvent.type(screen.getByLabelText('Treść kroku 2'), 'Podaj.');
    });
    expect(body.steps[1]).toEqual({ position: 1, title: 'Podanie', text: 'Podaj.' });
  });

  it('removes a step', async () => {
    const body = await saveAfter(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Usuń krok 1' }));
      expect(screen.queryByLabelText('Treść kroku 2')).not.toBeInTheDocument();
    }, TWO);
    expect(body.steps).toEqual([{ position: 0, title: null, text: 'B' }]);
  });

  it('moves a step down', async () => {
    const body = await saveAfter(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Przesuń krok 1 w dół' }));
    }, TWO);
    expect(body.steps.map((s: { text: string }) => s.text)).toEqual(['B', 'A']);
  });

  it('moves a step up', async () => {
    const body = await saveAfter(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Przesuń krok 2 w górę' }));
    }, TWO);
    expect(body.steps.map((s: { text: string }) => s.text)).toEqual(['B', 'A']);
  });
});

describe('ImportReviewForm source author', () => {
  it('saves the trimmed author', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 'r1' }), { status: 201 })),
    );
    render(<ImportReviewForm extracted={BASE as never} sourceUrl="" onCancel={() => {}} onSaved={() => {}} />);
    await userEvent.type(screen.getByLabelText('Autor przepisu'), '  Ania Gotuje ');
    await userEvent.click(screen.getByText('mock-pick'));
    await userEvent.click(screen.getByRole('button', { name: /zapisz przepis/i }));
    const calls = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    await waitFor(() => expect(calls.length).toBe(1));
    expect(JSON.parse(calls[0][1].body as string).source_author).toBe('Ania Gotuje');
  });

  it('saves null when left blank', async () => {
    expect((await saveWith({})).source_author).toBeNull();
  });
});

describe('ImportReviewForm auto-match outcome', () => {
  const ING = (id: string, name: string) => ({
    id,
    name,
    category: 'inne',
    kcal_per_100g: 100,
    protein_per_100g: 1,
    fat_per_100g: 1,
    carbs_per_100g: 1,
    default_unit: 'g',
  });

  it('labels each import line as matched, created or unmatched', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/ingredients' && !init)
        return new Response(JSON.stringify([ING('m1', 'mąka')]), { status: 200 });
      if (url.startsWith('/api/ingredients/lookup')) {
        const q = decodeURIComponent(url.split('q=')[1]);
        const candidate = {
          name: q,
          category: 'inne',
          kcal_per_100g: 1,
          protein_per_100g: 1,
          fat_per_100g: 1,
          carbs_per_100g: 1,
          default_unit: null,
          source: 'off',
        };
        return new Response(JSON.stringify(q === 'cukier' || q === 'sól' ? [candidate] : []), { status: 200 });
      }
      if (url === '/api/ingredients' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        // Creating "sól" fails; "cukier" succeeds.
        if (body.name === 'sól') return new Response('{}', { status: 500 });
        return new Response(JSON.stringify(ING('c1', body.name)), { status: 201 });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ImportReviewForm
        extracted={
          {
            ...BASE,
            recipeIngredient: [
              { name: 'mąka', amount: 200, unit: 'g', optional: false },
              { name: 'cukier', amount: 1, unit: 'g', optional: false },
              { name: 'sól', amount: 1, unit: 'g', optional: false },
            ],
          } as never
        }
        sourceUrl=""
        onCancel={() => {}}
        onSaved={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Auto-mapuj składniki' }));

    expect(await screen.findByText('Dopasowano')).toBeInTheDocument();
    expect(screen.getByText('Utworzono — sprawdź makra')).toBeInTheDocument();
    expect(screen.getByText('Nie dopasowano — dodaj ręcznie')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Dopasowano: 1 · utworzono: 1 · bez dopasowania: 1');
    // Re-running would create the OFF ingredients again.
    expect(screen.queryByRole('button', { name: 'Auto-mapuj składniki' })).not.toBeInTheDocument();
  });

  it('shows a Polish error when auto-match fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    render(<ImportReviewForm extracted={BASE as never} sourceUrl="" onCancel={() => {}} onSaved={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Auto-mapuj składniki' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się dopasować składników');
  });

  it('shows a Polish error, not the server text, when saving fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'ZodError raw' }), { status: 400 })),
    );
    render(<ImportReviewForm extracted={BASE as never} sourceUrl="" onCancel={() => {}} onSaved={() => {}} />);
    await userEvent.click(screen.getByText('mock-pick'));
    await userEvent.click(screen.getByRole('button', { name: /zapisz przepis/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać przepisu');
    expect(screen.queryByText(/ZodError/)).not.toBeInTheDocument();
  });
});
