import { describe, it, expect } from 'vitest';
import { parseIngredientLine, parseIngredientLines, cleanIngredientName } from '@/lib/import/parse-ingredient';

describe('parseIngredientLine', () => {
  it('parses simple grams', () => {
    expect(parseIngredientLine('kiełbasa hiszpańska chorizo np. dulce 200 g'))
      .toEqual({ name: 'kiełbasa hiszpańska chorizo np. dulce', amount: 200, unit: 'g' });
  });

  it('parses milliliters', () => {
    expect(parseIngredientLine('olej roślinny do smażenia 40 ml'))
      .toEqual({ name: 'olej roślinny do smażenia', amount: 40, unit: 'ml' });
  });

  it('parses ząbki', () => {
    expect(parseIngredientLine('czosnek świeży 6 ząbków'))
      .toEqual({ name: 'czosnek świeży', amount: 6, unit: 'ząbek' });
  });

  it('parses word fractions (pół)', () => {
    expect(parseIngredientLine('sól pół łyżeczki'))
      .toEqual({ name: 'sól', amount: 0.5, unit: 'łyżeczka' });
  });

  it('parses slash fractions', () => {
    expect(parseIngredientLine('chili 1/4 łyżeczki'))
      .toEqual({ name: 'chili', amount: 0.25, unit: 'łyżeczka' });
  });

  it('takes first amount when multiple present', () => {
    expect(parseIngredientLine('papryka świeża np. czerwona 400 g - 2 sztuki'))
      .toEqual({ name: 'papryka świeża np. czerwona', amount: 400, unit: 'g' });
  });

  it('returns name only when no amount/unit found', () => {
    expect(parseIngredientLine('szczypta soli'))
      .toEqual({ name: 'szczypta soli', amount: null, unit: null });
  });
});

describe('parseIngredientLines', () => {
  it('splits a compound "X i Y po <qty>" line into two ingredients', () => {
    expect(parseIngredientLines('chili i kumin po 1/4 łyżeczki')).toEqual([
      { name: 'chili', amount: 0.25, unit: 'łyżeczka' },
      { name: 'kumin', amount: 0.25, unit: 'łyżeczka' },
    ]);
  });

  it('returns a single result for a non-compound line', () => {
    expect(parseIngredientLines('cebula np. cukrowa 300 g')).toEqual([
      { name: 'cebula np. cukrowa', amount: 300, unit: 'g' },
    ]);
  });

  it('falls back to a single result when "i...po" pattern has no unit', () => {
    expect(parseIngredientLines('mąka i cukier po trosze')).toEqual([
      parseIngredientLine('mąka i cukier po trosze'),
    ]);
  });
});

describe('cleanIngredientName', () => {
  it('strips "np. X" suggestions', () => {
    expect(cleanIngredientName('kiełbasa hiszpańska chorizo np. dulce')).toBe('kiełbasa hiszpańska chorizo');
  });

  it('strips parenthetical asides', () => {
    expect(cleanIngredientName('mąka (dowolna) pszenna')).toBe('mąka pszenna');
  });

  it('leaves already-clean names untouched', () => {
    expect(cleanIngredientName('cebula')).toBe('cebula');
  });
});
