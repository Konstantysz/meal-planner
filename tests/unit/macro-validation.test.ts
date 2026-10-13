import { describe, it, expect } from 'vitest';
import { atwaterKcal, validateMacros, ATWATER_SLACK_KCAL, MACRO_LIMITS } from '@/lib/macro-validation';
import { IngredientInputSchema } from '@/lib/schemas';

const m = (kcal: number | null, protein: number | null, fat: number | null, carbs: number | null) => ({
  kcal_per_100g: kcal,
  protein_per_100g: protein,
  fat_per_100g: fat,
  carbs_per_100g: carbs,
});

describe('atwaterKcal', () => {
  it('is 4/9/4 kcal per gram of protein, fat and carbs', () => {
    expect(atwaterKcal(m(null, 10, 10, 10))).toBe(170);
  });

  it('is null when a macro is missing', () => {
    expect(atwaterKcal(m(100, 10, null, 10))).toBeNull();
  });
});

describe('validateMacros: range rules', () => {
  it('accepts plausible values and the 0/100 and 900 kcal boundaries', () => {
    expect(validateMacros(m(364, 10.3, 1, 76.3))).toEqual([]);
    expect(validateMacros(m(884, 0, 100, 0))).toEqual([]);
    expect(validateMacros(m(MACRO_LIMITS.maxKcal, 0, 100, 0))).toEqual([]);
    expect(validateMacros(m(0, 0, 0, 0))).toEqual([]);
  });

  it('does not judge missing values', () => {
    expect(validateMacros(m(null, null, null, null))).toEqual([]);
    expect(validateMacros(m(250, null, 20, null))).toEqual([]);
  });

  it('rejects each macro above 100 g or below 0', () => {
    expect(validateMacros(m(400, 100.1, 0, 0))).toContain('protein_range');
    expect(validateMacros(m(400, 0, -1, 0))).toContain('fat_range');
    expect(validateMacros(m(400, 0, 0, 101))).toContain('carbs_range');
  });

  it('rejects kcal above 900 or below 0', () => {
    expect(validateMacros(m(900.5, 0, 100, 0))).toContain('kcal_range');
    expect(validateMacros(m(-1, 0, 0, 0))).toEqual(['kcal_range']);
  });

  it('rejects a macro sum above 100 g, with 1 g of rounding tolerance', () => {
    expect(validateMacros(m(500, 40, 40, 30))).toEqual(['macro_sum']);
    expect(validateMacros(m(400, 0.5, 0.4, 100))).toEqual([]);
    expect(validateMacros(m(400, 0.6, 0.5, 100))).toEqual(['macro_sum']);
  });

  it('accepts a spice-like row that misses the Atwater estimate (no Atwater rule on save)', () => {
    // Cinnamon (fibre counted in carbs): 247 kcal vs. an Atwater estimate of 351.
    expect(validateMacros(m(247, 4, 1.2, 81))).toEqual([]);
    expect(validateMacros(m(150, 4, 1.2, 81))).toEqual([]);
  });

  it('accepts an alcohol-like row on save: kcal without protein, fat or carbs', () => {
    expect(validateMacros(m(231, 0, 0, 0))).toEqual([]);
  });
});

describe('validateMacros: Atwater rule (Open Food Facts results)', () => {
  // 100 g carbs: estimate 400 kcal, so the 0.6× and 1.2× boundaries are 240 and 480 kcal.
  it('accepts kcal at exactly 0.6× and 1.2× the estimate', () => {
    expect(validateMacros(m(240, 0, 0, 100), { atwater: true })).toEqual([]);
    expect(validateMacros(m(480, 0, 0, 100), { atwater: true })).toEqual([]);
  });

  it('rejects kcal just outside 0.6× and 1.2× the estimate', () => {
    expect(validateMacros(m(239.9, 0, 0, 100), { atwater: true })).toEqual(['atwater']);
    expect(validateMacros(m(480.1, 0, 0, 100), { atwater: true })).toEqual(['atwater']);
  });

  it('allows a small absolute difference for near-zero rows', () => {
    // Black coffee: 2 kcal vs. an estimate of 0.4 (ratio 5×), still within the slack.
    expect(validateMacros(m(2, 0.1, 0, 0), { atwater: true })).toEqual([]);
    expect(validateMacros(m(ATWATER_SLACK_KCAL + 0.1, 0, 0, 0), { atwater: true })).toEqual(['atwater']);
  });

  it('rejects an alcohol-like row as an Open Food Facts result', () => {
    expect(validateMacros(m(231, 0, 0, 0), { atwater: true })).toEqual(['atwater']);
  });

  it('does not judge Atwater when a value is missing', () => {
    expect(validateMacros(m(null, 10, 10, 10), { atwater: true })).toEqual([]);
    expect(validateMacros(m(500, 10, null, 10), { atwater: true })).toEqual([]);
  });

  it('rejects the two known bad Open Food Facts rows', () => {
    // Peanut butter with protein/fat/carbs ×3.125 too high.
    expect(validateMacros(m(593.75, 75, 156.25, 43.75), { atwater: true })).toEqual(
      expect.arrayContaining(['fat_range', 'macro_sum']),
    );
    // Skyr with kcal ÷3.5 too low.
    expect(validateMacros(m(22.2857142857143, 6.5, 1.5, 9.5), { atwater: true })).toEqual(['atwater']);
    // The corrected values pass.
    expect(validateMacros(m(593.75, 24, 50, 14), { atwater: true })).toEqual([]);
    expect(validateMacros(m(78, 6.5, 1.5, 9.5), { atwater: true })).toEqual([]);
  });
});

describe('IngredientInputSchema uses the range rules', () => {
  const base = { name: 'x', category: 'inne', default_unit: 'g', source: 'manual' } as const;

  it('rejects out-of-range macros on save', () => {
    expect(IngredientInputSchema.safeParse({ ...base, ...m(593.75, 75, 156.25, 43.75) }).success).toBe(false);
    expect(IngredientInputSchema.safeParse({ ...base, ...m(950, 0, 0, 0) }).success).toBe(false);
  });

  it('accepts valid, macro-less and alcohol-like rows on save', () => {
    expect(IngredientInputSchema.safeParse({ ...base, ...m(717, 0.9, 81.1, 0.1) }).success).toBe(true);
    expect(IngredientInputSchema.safeParse({ ...base, ...m(null, null, null, null) }).success).toBe(true);
    expect(IngredientInputSchema.safeParse({ ...base, ...m(231, 0, 0, 0) }).success).toBe(true);
  });
});
