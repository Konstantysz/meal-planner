import { describe, it, expect, vi } from 'vitest';
import { autoMatchIngredients } from '@/lib/import/auto-match';
import type { Ingredient } from '@/lib/types';
import type { IngredientInput } from '@/lib/schemas';

// Real 10-line ingredient list extracted from an actual imported recipe
// (aniagotuje.pl "Leczo z chorizo"), used to catch regressions end-to-end
// instead of only on synthetic single-line cases.
const LECZO_LINES = [
  'kiełbasa hiszpańska chorizo np. dulce 200 g',
  'papryka świeża np. czerwona 400 g - 2 sztuki',
  'cebula np. cukrowa 300 g',
  'cukinia zielona lub żółta 650 g - 2 sztuki',
  'pomidory 500 g',
  'czosnek świeży 6 ząbków',
  'olej roślinny do smażenia 40 ml',
  'słodka papryka w proszku 1 łyżeczka',
  'sól pół łyżeczki',
  'chili i kumin po 1/4 łyżeczki',
];

function ing(name: string): Ingredient {
  return {
    id: name, name, category: 'inne',
    kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null,
    default_unit: null, source: 'manual',
  };
}

function off(name: string): IngredientInput {
  return {
    name, category: 'inne',
    kcal_per_100g: 100, protein_per_100g: 5, fat_per_100g: 5, carbs_per_100g: 10,
    default_unit: 'g', source: 'off',
  };
}

describe('autoMatchIngredients — leczo z chorizo (integration)', () => {
  it('matches every line to either a local ingredient, an OFF candidate, or a fallback — never drops a line', async () => {
    const localIngredients = [ing('cebula'), ing('pomidor'), ing('czosnek')];
    // Simulate OFF having real products for some queries, nothing for niche/compound ones
    // (mirrors reality: OFF covers branded/common items like chorizo or cooking oil well,
    // but has poor coverage for generic spice blends like "słodka papryka w proszku").
    const OFF_CATALOG: Record<string, IngredientInput> = {
      'kiełbasa hiszpańska chorizo': off('Chorizo'),
      'papryka świeża': off('Papryka czerwona'),
      'cukinia zielona lub żółta': off('Cukinia'),
      'olej roślinny do smażenia': off('Olej roślinny'),
    };
    const searchOff = vi.fn(async (q: string) => {
      const hit = OFF_CATALOG[q];
      return hit ? [hit] : [];
    });

    const results = await autoMatchIngredients(LECZO_LINES, localIngredients, { searchOff });

    // 10 lines, but "chili i kumin po 1/4 łyżeczki" splits into 2 -> 11 results.
    expect(results).toHaveLength(11);
    for (const r of results) {
      expect(r.ingredient !== null || r.offCandidate !== null || r.fallbackCandidate !== null).toBe(true);
    }

    // Local matches
    expect(results[2].ingredient?.name).toBe('cebula'); // cebula np. cukrowa
    expect(results[4].ingredient?.name).toBe('pomidor'); // pomidory
    expect(results[5].ingredient?.name).toBe('czosnek'); // czosnek świeży

    // OFF matches
    expect(results[0].offCandidate?.name).toBe('Chorizo');
    expect(results[1].offCandidate?.name).toBe('Papryka czerwona');
    expect(results[3].offCandidate?.name).toBe('Cukinia');
    expect(results[6].offCandidate?.name).toBe('Olej roślinny');

    // No local/OFF match: słodka papryka w proszku, sól, chili, kumin — must fall back, not drop.
    expect(results[7].fallbackCandidate).not.toBeNull(); // słodka papryka w proszku
    expect(results[8].fallbackCandidate).not.toBeNull(); // sól
    expect(results[9].fallbackCandidate?.name).toBe('chili');
    expect(results[10].fallbackCandidate?.name).toBe('kumin');

    // Amounts/units parsed correctly regardless of match source
    expect(results[0]).toMatchObject({ amount: 200, unit: 'g' });
    expect(results[1]).toMatchObject({ amount: 400, unit: 'g' });
    expect(results[5]).toMatchObject({ amount: 6, unit: 'ząbek' });
    expect(results[8]).toMatchObject({ amount: 0.5, unit: 'łyżeczka' });
    expect(results[9]).toMatchObject({ amount: 0.25, unit: 'łyżeczka' });
    expect(results[10]).toMatchObject({ amount: 0.25, unit: 'łyżeczka' });

    // raw_text is the clean name only — amount/unit stay in their own fields.
    expect(results[2].raw_text).toBe('cebula');
  });

  it('matches all lines to a real ingredient/candidate when OFF is completely empty', async () => {
    const searchOff = vi.fn().mockResolvedValue([]);
    const results = await autoMatchIngredients(LECZO_LINES, [], { searchOff });
    expect(results).toHaveLength(11);
    for (const r of results) {
      expect(r.ingredient ?? r.offCandidate ?? r.fallbackCandidate).not.toBeNull();
    }
  });
});
