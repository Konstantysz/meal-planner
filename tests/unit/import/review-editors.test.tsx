import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
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

import { StepsEditor, type EditableStep } from '@/components/recipes/StepsEditor';
import { ExtractedIngredientsEditor } from '@/components/import/ExtractedIngredientsEditor';
import { ImportReviewForm } from '@/components/import/ImportReviewForm';
import type { ExtractedIngredient } from '@/lib/import/schema';

afterEach(() => vi.unstubAllGlobals());

function StepsHarness({ initial, spy }: { initial: EditableStep[]; spy: (s: EditableStep[]) => void }) {
  const [steps, setSteps] = useState(initial);
  spy(steps);
  return <StepsEditor steps={steps} onChange={setSteps} />;
}

function RowsHarness({ initial, spy }: { initial: ExtractedIngredient[]; spy: (r: ExtractedIngredient[]) => void }) {
  const [rows, setRows] = useState(initial);
  spy(rows);
  return <ExtractedIngredientsEditor rows={rows} onChange={setRows} />;
}

describe('StepsEditor', () => {
  it('adds, edits, moves and removes steps', async () => {
    let latest: EditableStep[] = [];
    render(<StepsHarness initial={[{ title: '', text: 'jeden' }]} spy={(s) => (latest = s)} />);

    await userEvent.click(screen.getByRole('button', { name: '+ krok' }));
    expect(latest).toHaveLength(2);
    await userEvent.type(screen.getByLabelText('Treść kroku 2'), 'dwa');
    await userEvent.type(screen.getByLabelText('Tytuł kroku 2'), 'Drugi');

    await userEvent.click(screen.getByRole('button', { name: 'Przesuń krok 2 w górę' }));
    expect(latest.map((s) => s.text)).toEqual(['dwa', 'jeden']);
    expect(latest[0].title).toBe('Drugi');
    expect(screen.getByRole('button', { name: 'Przesuń krok 1 w górę' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Przesuń krok 2 w dół' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Usuń krok 1' }));
    expect(latest).toEqual([{ title: '', text: 'jeden' }]);
  });
});

describe('ExtractedIngredientsEditor', () => {
  it('adds a blank row, edits amount/unit/optional, moves and removes', async () => {
    let latest: ExtractedIngredient[] = [];
    render(
      <RowsHarness
        initial={[{ name: 'sól', amount: 1, unit: 'szczypta', optional: false, range: '1-2' }]}
        spy={(r) => (latest = r)}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '+ składnik' }));
    expect(latest).toHaveLength(2);
    expect(latest[1]).toEqual({ name: '', amount: null, unit: null, optional: false });

    await userEvent.type(screen.getByLabelText('Nazwa składnika z importu 2'), 'mąka');
    await userEvent.type(screen.getByLabelText('Ilość składnika z importu 2'), '200');
    await userEvent.type(screen.getByLabelText('Jednostka składnika z importu 2'), 'g');
    await userEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(latest[1]).toMatchObject({ name: 'mąka', amount: 200, unit: 'g', optional: true });

    // editing an amount drops the stale source range
    await userEvent.clear(screen.getByLabelText('Ilość składnika z importu 1'));
    await userEvent.type(screen.getByLabelText('Ilość składnika z importu 1'), '3');
    expect(latest[0].amount).toBe(3);
    expect(latest[0].range).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: 'Przesuń składnik z importu 2 w górę' }));
    expect(latest.map((r) => r.name)).toEqual(['mąka', 'sól']);

    await userEvent.click(screen.getByRole('button', { name: 'Usuń składnik z importu 1' }));
    expect(latest.map((r) => r.name)).toEqual(['sól']);
  });
});

describe('ImportReviewForm editing', () => {
  const BASE = {
    name: 'Zupa',
    recipeIngredient: [
      { name: 'cebula', amount: 1, unit: null, optional: false },
      { name: 'sól', amount: null, unit: null, optional: false },
    ],
    recipeInstructions: [
      { title: null, text: 'pierwszy' },
      { title: null, text: 'drugi' },
    ],
  };

  function renderForm() {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'r1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ImportReviewForm extracted={BASE as never} sourceUrl="https://a.pl/x" onCancel={() => {}} onSaved={() => {}} />,
    );
    return fetchMock;
  }

  it('saves added, reordered steps; drops empty ones; sends source_author', async () => {
    const fetchMock = renderForm();
    await userEvent.click(screen.getByRole('button', { name: '+ krok' }));
    await userEvent.type(screen.getByLabelText('Treść kroku 3'), 'trzeci');
    await userEvent.click(screen.getByRole('button', { name: '+ krok' })); // stays empty
    await userEvent.click(screen.getByRole('button', { name: 'Usuń krok 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Przesuń krok 2 w górę' }));
    await userEvent.type(screen.getByLabelText('Autor przepisu'), '  Ania Gotuje ');

    await userEvent.click(screen.getByText('mock-pick'));
    await userEvent.click(screen.getByRole('button', { name: /zapisz przepis/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls as unknown as [string, RequestInit][])[0][1].body as string);
    expect(body.steps).toEqual([
      { position: 0, title: null, text: 'trzeci' },
      { position: 1, title: null, text: 'drugi' },
    ]);
    expect(body.source_author).toBe('Ania Gotuje');
  });

  it('auto-match uses the edited rows: removed row gone, added row present', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      if (url === '/api/ingredients')
        return new Response(
          JSON.stringify([
            { id: 'c', name: 'mąka', default_unit: 'g', category: 'inne' },
            { id: 'd', name: 'cebula', default_unit: 'g', category: 'inne' },
          ]),
        );
      return new Response('[]');
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ImportReviewForm extracted={BASE as never} sourceUrl="" onCancel={() => {}} onSaved={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Usuń składnik z importu 2' }));
    await userEvent.click(screen.getByRole('button', { name: '+ składnik' }));
    await userEvent.type(screen.getByLabelText('Nazwa składnika z importu 2'), 'mąka');
    await userEvent.click(screen.getByRole('button', { name: 'Auto-mapuj składniki' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Dopasowane: 2, nowe: 0, bez dopasowania: 0.'),
    );
  });
});
