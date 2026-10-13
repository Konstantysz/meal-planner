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

  it('rounds decimals to an integer', async () => {
    const body = await saveWith({ prepTime: 'PT20M' }, '12.5');
    expect(Number.isInteger(body.prep_time_min)).toBe(true);
  });

  it('never saves a negative value', async () => {
    const body = await saveWith({ prepTime: 'PT20M' }, '-3');
    expect(body.prep_time_min).toBeGreaterThanOrEqual(0);
  });
});

describe('ImportReviewForm Open Food Facts disclaimer', () => {
  it('shows the disclaimer next to the auto-match button', () => {
    render(<ImportReviewForm extracted={BASE as never} sourceUrl="" onCancel={() => {}} onSaved={() => {}} />);
    expect(screen.getByText(/Dane z Open Food Facts/)).toBeInTheDocument();
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
});
