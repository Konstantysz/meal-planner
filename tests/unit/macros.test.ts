import { describe, it, expect } from 'vitest';
import {
  calculateIngredientMacros,
  sumMacros,
  perServing,
  hasMacros,
  toGrams,
  recipeMacros,
  type MacroRecipeIngredient,
} from '@/lib/macros';

describe('calculateIngredientMacros', () => {
  it('computes macros for grams', () => {
    const r = calculateIngredientMacros(
      { kcal_per_100g: 364, protein_per_100g: 10.3, fat_per_100g: 1, carbs_per_100g: 76.3 },
      200,
    );
    expect(r?.kcal).toBe(728);
    expect(r?.protein).toBeCloseTo(20.6);
  });

  it('returns null when ingredient has no macro data', () => {
    const r = calculateIngredientMacros(
      { kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null },
      100,
    );
    expect(r).toBeNull();
  });

  it('treats missing fields as zero', () => {
    const r = calculateIngredientMacros(
      { kcal_per_100g: 100, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null },
      100,
    );
    expect(r?.kcal).toBe(100);
    expect(r?.protein).toBe(0);
  });
});

describe('sumMacros', () => {
  it('skips nulls', () => {
    const s = sumMacros([
      { kcal: 100, protein: 1, fat: 2, carbs: 3 },
      null,
      { kcal: 50, protein: 1, fat: 1, carbs: 1 },
    ]);
    expect(s.kcal).toBe(150);
  });
});

describe('perServing', () => {
  it('divides by servings', () => {
    const p = perServing({ kcal: 1000, protein: 40, fat: 30, carbs: 100 }, 4);
    expect(p?.kcal).toBe(250);
  });

  it('returns null for zero servings', () => {
    expect(perServing({ kcal: 1000, protein: 0, fat: 0, carbs: 0 }, 0)).toBeNull();
  });

  it('returns null for negative servings', () => {
    expect(perServing({ kcal: 1000, protein: 0, fat: 0, carbs: 0 }, -1)).toBeNull();
  });
});

describe('hasMacros', () => {
  const none = { kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null };
  it('is false when all four fields are null', () => {
    expect(hasMacros(none)).toBe(false);
  });
  it.each(['kcal_per_100g', 'protein_per_100g', 'fat_per_100g', 'carbs_per_100g'] as const)(
    'is true when only %s is set',
    (field) => {
      expect(hasMacros({ ...none, [field]: 0 })).toBe(true);
    },
  );
  it('is true for fat and carbs only', () => {
    expect(hasMacros({ ...none, fat_per_100g: 5, carbs_per_100g: 10 })).toBe(true);
  });
});

describe('toGrams', () => {
  it.each([
    [2, 'mg', 0.002],
    [250, 'g', 250],
    [3, 'dag', 30],
    [1.5, 'kg', 1500],
    [200, 'ml', 200],
    [5, 'cl', 50],
    [2, 'dl', 200],
    [0.5, 'l', 500],
  ])('%s %s is %s g', (amount, unit, grams) => {
    expect(toGrams(amount, unit)).toBeCloseTo(grams);
  });

  it('ignores case and surrounding spaces', () => {
    expect(toGrams(1, ' KG ')).toBe(1000);
  });

  it('accepts Polish abbreviations and one trailing dot', () => {
    expect(toGrams(5, 'dkg')).toBe(50);
    expect(toGrams(150, 'gr')).toBe(150);
    expect(toGrams(1, 'kg.')).toBe(1000);
    expect(toGrams(0.5, 'l.')).toBe(500);
    expect(toGrams(3, 'dkg.')).toBe(30);
    expect(toGrams(1, 'kg..')).toBeNull();
  });

  it('falls back to the inflected forms normalizeUnit knows', () => {
    expect(toGrams(200, 'gramów')).toBe(200);
    expect(toGrams(1, 'litra')).toBe(1000);
    expect(toGrams(2, 'łyżki')).toBeNull();
  });

  it('returns null for units that are not a mass or volume multiple', () => {
    for (const unit of ['łyżka', 'łyżeczka', 'szklanka', 'sztuki', 'szt', 'garść', '', null]) {
      expect(toGrams(1, unit)).toBeNull();
    }
  });
});

describe('recipeMacros', () => {
  const oil = { name: 'oliwa', kcal_per_100g: 900, protein_per_100g: 0, fat_per_100g: 100, carbs_per_100g: 0 };
  const rice = { name: 'ryż', kcal_per_100g: 350, protein_per_100g: 7, fat_per_100g: 1, carbs_per_100g: 78 };
  const salt = { name: 'sól', kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null };
  const ing = (
    ingredients: MacroRecipeIngredient['ingredients'],
    amount: number | null,
    unit: string | null = 'g',
    optional = false,
  ): MacroRecipeIngredient => ({ amount, unit, optional, raw_text: 'surowy tekst', ingredients });

  it('reports a fully known recipe as complete', () => {
    const r = recipeMacros([ing(rice, 0.2, 'kg'), ing(oil, 2, 'cl')], 2);
    expect(r.total.kcal).toBeCloseTo(700 + 180);
    expect(r.perServing?.kcal).toBeCloseTo(440);
    expect(r.complete).toBe(true);
    expect(r.leftOut).toEqual([]);
  });

  it('reports each left-out ingredient with its reason and keeps the rest of the sum', () => {
    const r = recipeMacros([ing(rice, 200), ing(salt, 5), ing(oil, 2, 'łyżka'), ing(oil, null), ing(null, 50)], 1);
    expect(r.total.kcal).toBeCloseTo(700);
    expect(r.perServing?.kcal).toBeCloseTo(700);
    expect(r.complete).toBe(false);
    expect(r.leftOut).toEqual([
      { name: 'sól', reason: 'no_macros' },
      { name: 'oliwa', reason: 'unit' },
      { name: 'oliwa', reason: 'no_amount' },
      { name: 'surowy tekst', reason: 'no_macros' },
    ]);
  });

  it('falls back to raw_text and then to „składnik" when the name is empty', () => {
    const blank = { ...salt, name: '' };
    expect(recipeMacros([ing(blank, 5)], 1).leftOut).toEqual([{ name: 'surowy tekst', reason: 'no_macros' }]);
    expect(recipeMacros([{ ...ing(blank, 5), raw_text: '  ' }], 1).leftOut).toEqual([
      { name: 'składnik', reason: 'no_macros' },
    ]);
  });

  it('reports a macro-less ingredient as no_macros even without an amount or with a non-gram unit', () => {
    expect(recipeMacros([ing(rice, 100), ing(salt, null, 'szczypta')], 1).leftOut).toEqual([
      { name: 'sól', reason: 'no_macros' },
    ]);
  });

  it('keeps excluding optional ingredients without reporting them', () => {
    const r = recipeMacros([ing(rice, 100), ing(oil, 1, 'łyżka', true), ing(salt, 5, 'g', true)], 1);
    expect(r.total.kcal).toBeCloseTo(350);
    expect(r.complete).toBe(true);
    expect(r.leftOut).toEqual([]);
  });

  it('has no per-serving value when nothing was counted', () => {
    expect(recipeMacros([], 2)).toMatchObject({ perServing: null, complete: false, leftOut: [] });
    expect(recipeMacros([ing(oil, 1, 'g', true)], 2)).toMatchObject({ perServing: null, complete: false });
    const r = recipeMacros([ing(salt, 5)], 2);
    expect(r).toMatchObject({ perServing: null, complete: false });
    expect(r.leftOut).toHaveLength(1);
  });

  it('has no per-serving value for 0 servings', () => {
    expect(recipeMacros([ing(rice, 100)], 0).perServing).toBeNull();
  });
});
