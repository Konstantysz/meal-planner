import { describe, it, expect, vi } from 'vitest';
import { autoMatchIngredients } from '@/lib/import/auto-match';
import type { Ingredient } from '@/lib/types';
import type { ExtractedIngredient } from '@/lib/import/schema';

function ing(name: string, withMacros = false): Ingredient {
  return {
    id: name,
    name,
    category: 'inne',
    kcal_per_100g: withMacros ? 40 : null,
    protein_per_100g: withMacros ? 1 : null,
    fat_per_100g: withMacros ? 0 : null,
    carbs_per_100g: withMacros ? 9 : null,
    default_unit: null,
    source: 'manual',
  };
}

describe('autoMatchIngredients', () => {
  const line = (name: string, amount: number | null = null, unit: string | null = null, optional = false) =>
    ({ name, amount, unit, optional }) satisfies ExtractedIngredient;
  const offResult = {
    name: 'Chorizo',
    category: 'mieso' as const,
    kcal_per_100g: 300,
    protein_per_100g: 20,
    fat_per_100g: 25,
    carbs_per_100g: 1,
    default_unit: 'g',
    source: 'off' as const,
  };

  it('uses local match when found and it has macro data, skipping OFF lookup', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients([line('cebula', 300, 'g')], [ing('cebula', true)], { searchOff });
    expect(results[0].ingredient?.name).toBe('cebula');
    expect(results[0].amount).toBe(300);
    expect(results[0].unit).toBe('g');
    expect(searchOff).not.toHaveBeenCalled();
  });

  it('falls through to OFF when local match has no macro data', async () => {
    const searchOff = vi.fn().mockResolvedValue([offResult]);
    const results = await autoMatchIngredients([line('cebula', 300, 'g')], [ing('cebula', false)], { searchOff });
    expect(searchOff).toHaveBeenCalledWith('cebula');
    expect(results[0].offCandidate?.name).toBe('Chorizo');
    expect(results[0].ingredient).toBeNull();
  });

  it('keeps a macro-less local match when OFF has no data either', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients([line('cebula', 300, 'g')], [ing('cebula', false)], { searchOff });
    expect(results[0].ingredient?.name).toBe('cebula');
    expect(results[0].offCandidate).toBeNull();
    expect(results[0].fallbackCandidate).toBeNull();
  });

  it('falls back to OFF candidate when no local match', async () => {
    const searchOff = vi.fn().mockResolvedValue([offResult]);
    const results = await autoMatchIngredients([line('chorizo', 200, 'g')], [], { searchOff });
    expect(results[0].ingredient).toBeNull();
    expect(results[0].offCandidate).toEqual(offResult);
  });

  it('provides a fallback candidate when OFF has no results', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients([line('nieznany składnik', 1, 'g')], [], { searchOff });
    expect(results[0].offCandidate).toBeNull();
    expect(results[0].fallbackCandidate).toMatchObject({ name: 'nieznany składnik', source: 'manual' });
  });

  it('provides a fallback candidate when OFF lookup fails', async () => {
    const searchOff = vi.fn().mockRejectedValue(new Error('network'));
    const results = await autoMatchIngredients([line('coś', 1, 'g')], [], { searchOff });
    expect(results[0].offCandidate).toBeNull();
    expect(results[0].fallbackCandidate).toMatchObject({ name: 'coś' });
  });

  it('keeps one result per ingredient and passes amount, unit and optional through', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients(
      [line('cebula', 100, 'g'), line('natka pietruszki', 1, 'łyżka', true)],
      [],
      {
        searchOff,
      },
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ raw_text: 'cebula', amount: 100, unit: 'g', optional: false });
    expect(results[1]).toMatchObject({ raw_text: 'natka pietruszki', amount: 1, unit: 'łyżka', optional: true });
  });
});
