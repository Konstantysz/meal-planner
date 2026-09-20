import { describe, it, expect, vi } from 'vitest';
import { autoMatchIngredients } from '@/lib/import/auto-match';
import type { Ingredient } from '@/lib/types';

function ing(name: string): Ingredient {
  return {
    id: name, name, category: 'inne',
    kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null,
    default_unit: null, source: 'manual',
  };
}

describe('autoMatchIngredients', () => {
  it('uses local match when found, skipping OFF lookup', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients(
      ['cebula np. cukrowa 300 g'],
      [ing('cebula')],
      { searchOff }
    );
    expect(results[0].ingredient?.name).toBe('cebula');
    expect(results[0].amount).toBe(300);
    expect(results[0].unit).toBe('g');
    expect(searchOff).not.toHaveBeenCalled();
  });

  it('falls back to OFF candidate when no local match', async () => {
    const offResult = { name: 'Chorizo', category: 'mieso' as const, kcal_per_100g: 300,
      protein_per_100g: 20, fat_per_100g: 25, carbs_per_100g: 1, default_unit: 'g', source: 'off' as const };
    const searchOff = vi.fn().mockResolvedValue([offResult]);
    const results = await autoMatchIngredients(
      ['kiełbasa hiszpańska chorizo np. dulce 200 g'],
      [],
      { searchOff }
    );
    expect(results[0].ingredient).toBeNull();
    expect(results[0].offCandidate).toEqual(offResult);
    expect(searchOff).toHaveBeenCalled();
  });

  it('provides a fallback candidate when OFF has no results', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients(['nieznany składnik 1 g'], [], { searchOff });
    expect(results[0].ingredient).toBeNull();
    expect(results[0].offCandidate).toBeNull();
    expect(results[0].fallbackCandidate).toMatchObject({ name: 'nieznany składnik', source: 'manual' });
  });

  it('provides a fallback candidate when OFF lookup fails', async () => {
    const searchOff = vi.fn().mockRejectedValue(new Error('network'));
    const results = await autoMatchIngredients(['coś 1 g'], [], { searchOff });
    expect(results[0].offCandidate).toBeNull();
    expect(results[0].fallbackCandidate).toMatchObject({ name: 'coś' });
  });

  it('strips "np. X" noise before querying OFF', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    await autoMatchIngredients(['kiełbasa hiszpańska chorizo np. dulce 200 g'], [], { searchOff });
    expect(searchOff).toHaveBeenCalledWith('kiełbasa hiszpańska chorizo');
  });

  it('sets raw_text to the clean ingredient name only, not amount/unit/raw noise', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients(
      ['cebula np. cukrowa 300 g'], [ing('cebula')], { searchOff }
    );
    expect(results[0].raw_text).toBe('cebula');
    expect(results[0].amount).toBe(300);
    expect(results[0].unit).toBe('g');
  });

  it('splits a compound line into two separate results', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients(
      ['chili i kumin po 1/4 łyżeczki'], [], { searchOff }
    );
    expect(results).toHaveLength(2);
    expect(results[0].fallbackCandidate?.name).toBe('chili');
    expect(results[1].fallbackCandidate?.name).toBe('kumin');
    expect(results[0].amount).toBe(0.25);
    expect(results[1].amount).toBe(0.25);
  });
});
