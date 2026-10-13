import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IngredientPicker } from '@/components/recipes/IngredientPicker';
import { OFF_DISCLAIMER } from '@/components/recipes/OffDisclaimer';

const ing = (name: string, source: 'off' | 'manual') => ({
  id: name,
  name,
  category: 'inne',
  kcal_per_100g: null,
  protein_per_100g: null,
  fat_per_100g: null,
  carbs_per_100g: null,
  default_unit: 'g',
  source,
  created_by: null,
  created_at: '2026-10-13T00:00:00Z',
});

function renderPicker(rows: ReturnType<typeof ing>[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(rows))),
  );
  render(<IngredientPicker value={[]} onChange={() => {}} />);
}

afterEach(() => vi.unstubAllGlobals());

describe('Open Food Facts disclaimer in the ingredient picker', () => {
  it('shows the disclaimer when a result comes from Open Food Facts', async () => {
    renderPicker([ing('skyr naturalny', 'off')]);
    await userEvent.type(screen.getByPlaceholderText('Szukaj składnika…'), 'skyr');
    expect(await screen.findByText('skyr naturalny')).toBeInTheDocument();
    expect(screen.getByText(OFF_DISCLAIMER)).toBeInTheDocument();
  });

  it('hides it when no result comes from Open Food Facts', async () => {
    renderPicker([ing('skyr domowy', 'manual')]);
    await userEvent.type(screen.getByPlaceholderText('Szukaj składnika…'), 'skyr');
    expect(await screen.findByText('skyr domowy')).toBeInTheDocument();
    expect(screen.queryByText(OFF_DISCLAIMER)).not.toBeInTheDocument();
  });

  it('says the data is crowd-sourced and may contain errors', () => {
    expect(OFF_DISCLAIMER).toMatch(/Open Food Facts/);
    expect(OFF_DISCLAIMER).toMatch(/błędy/);
  });
});
