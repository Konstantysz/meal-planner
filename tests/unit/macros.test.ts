import { describe, it, expect } from 'vitest';
import { calculateIngredientMacros, sumMacros, perServing, hasMacros, recipeMacrosPerServing } from '@/lib/macros';

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

describe('recipeMacrosPerServing', () => {
  const flour = { kcal_per_100g: 364, protein_per_100g: 10, fat_per_100g: 1, carbs_per_100g: 76 };
  const none = { kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null };

  it('sums g and ml rows and divides by servings', () => {
    const m = recipeMacrosPerServing(
      [
        { amount: 200, unit: 'g', optional: false, ingredients: flour },
        { amount: 200, unit: 'ml', optional: false, ingredients: flour },
      ],
      4,
    );
    expect(m?.kcal).toBeCloseTo(364);
  });

  it('leaves out optional rows and rows without a matched ingredient', () => {
    const m = recipeMacrosPerServing(
      [
        { amount: 100, unit: 'g', optional: false, ingredients: flour },
        { amount: 100, unit: 'g', optional: true, ingredients: flour },
        { amount: 100, unit: 'g', optional: false, ingredients: null },
      ],
      1,
    );
    expect(m?.kcal).toBeCloseTo(364);
  });

  it('is null when nothing contributes (no macros, no weight, or unit other than g/ml)', () => {
    expect(recipeMacrosPerServing([{ amount: 100, unit: 'g', optional: false, ingredients: none }], 2)).toBeNull();
    expect(recipeMacrosPerServing([{ amount: 2, unit: 'szt', optional: false, ingredients: flour }], 2)).toBeNull();
    expect(recipeMacrosPerServing([{ amount: null, unit: 'g', optional: false, ingredients: flour }], 2)).toBeNull();
    expect(recipeMacrosPerServing([], 2)).toBeNull();
  });

  it('is null for zero servings', () => {
    expect(recipeMacrosPerServing([{ amount: 100, unit: 'g', optional: false, ingredients: flour }], 0)).toBeNull();
  });
});
