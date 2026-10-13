import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportReviewForm } from '@/components/import/ImportReviewForm';

// Real IngredientPicker (not mocked): the review form's ingredient rows are the shared building block.
const CATALOG = [
  { id: '3422d8ca-8907-49c2-8c83-da5fc298948f', name: 'Mąka', default_unit: 'g' },
  { id: '5b1f0c86-0e4f-4d0d-9a43-2b6d8b0f6a11', name: 'Mleko', default_unit: 'ml' },
];

function setup() {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({ id: 'r1' }), { status: 201 });
    return new Response(JSON.stringify(CATALOG), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <ImportReviewForm
      extracted={{ name: 'Naleśniki', recipeIngredient: [], recipeInstructions: [] } as never}
      sourceUrl=""
      onCancel={() => {}}
      onSaved={() => {}}
    />,
  );
  return fetchMock;
}

async function addIngredient(query: string, label: string) {
  await userEvent.type(screen.getByPlaceholderText('Szukaj składnika…'), query);
  await userEvent.click(await screen.findByRole('button', { name: label }));
}

afterEach(() => vi.unstubAllGlobals());

describe('ImportReviewForm ingredient rows', () => {
  it('adds rows manually, edits amount, unit and optional, and removes one', async () => {
    const fetchMock = setup();
    await addIngredient('mą', 'Mąka');
    await addIngredient('mle', 'Mleko');
    expect(screen.getAllByLabelText('Ilość')).toHaveLength(2);

    await userEvent.type(screen.getAllByLabelText('Ilość')[1], '250');
    await userEvent.clear(screen.getAllByLabelText('Jednostka')[1]);
    await userEvent.type(screen.getAllByLabelText('Jednostka')[1], 'szklanka');
    await userEvent.click(screen.getAllByRole('checkbox')[1]);

    await userEvent.click(screen.getAllByRole('button', { name: 'Usuń składnik' })[0]);
    expect(screen.getAllByLabelText('Ilość')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /zapisz przepis/i }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(post[1]!.body as string).ingredients).toEqual([
      {
        ingredient_id: CATALOG[1].id,
        amount: 250,
        unit: 'szklanka',
        raw_text: 'Mleko',
        position: 0,
        optional: true,
      },
    ]);
  });

  it('refuses to save once every row is removed', async () => {
    setup();
    await addIngredient('mą', 'Mąka');
    await userEvent.click(screen.getByRole('button', { name: 'Usuń składnik' }));
    await userEvent.click(screen.getByRole('button', { name: /zapisz przepis/i }));
    expect(await screen.findByText(/Zmapuj co najmniej jeden składnik/)).toBeInTheDocument();
  });
});
