import { describe, it, expect } from 'vitest';
import { scaleAmount, formatAmount, roundForUnit, positiveAmountOrNull } from '@/lib/scaling';

describe('scaleAmount', () => {
  it('multiplies structured amount', () => {
    const r = scaleAmount({ amount: 2, unit: 'g', raw_text: '2 g' }, 1.5);
    expect(r.amount).toBe(3);
    expect(r.raw_text).toBe('3 g');
  });

  it('preserves raw_text when amount is null', () => {
    const r = scaleAmount({ amount: null, unit: null, raw_text: 'do smaku' }, 3);
    expect(r.raw_text).toBe('do smaku');
    expect(r.amount).toBeNull();
  });
});

describe('formatAmount', () => {
  it('rounds grams to integer', () => {
    expect(formatAmount(133.7, 'g')).toBe('134 g');
  });
  it('keeps 2 decimals for kg', () => {
    expect(formatAmount(1.237, 'kg')).toBe('1.24 kg');
  });
  it('handles no unit', () => {
    expect(formatAmount(2.5, null)).toBe('2.5');
  });
});

describe('roundForUnit', () => {
  it('integers for g/ml', () => {
    expect(roundForUnit(133.7, 'g')).toBe(134);
    expect(roundForUnit(50.4, 'ml')).toBe(50);
  });
});

describe('positiveAmountOrNull', () => {
  it('keeps positive amounts', () => {
    expect(positiveAmountOrNull(0.5)).toBe(0.5);
  });
  it('turns 0, negatives, NaN and missing into null', () => {
    expect(positiveAmountOrNull(0)).toBeNull();
    expect(positiveAmountOrNull(-1)).toBeNull();
    expect(positiveAmountOrNull(Number.NaN)).toBeNull();
    expect(positiveAmountOrNull(null)).toBeNull();
    expect(positiveAmountOrNull(undefined)).toBeNull();
  });
});
