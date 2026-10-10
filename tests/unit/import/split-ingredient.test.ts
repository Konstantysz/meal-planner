import { describe, it, expect } from 'vitest';
import { splitIngredientLine } from '@/lib/import/split-ingredient';

const texts = (raw: string) => splitIngredientLine(raw).map((p) => p.text);

describe('splitIngredientLine', () => {
  it('returns a plain line as one non-optional part', () => {
    expect(splitIngredientLine('200 g mąki')).toEqual([{ text: '200 g mąki', optional: false }]);
  });

  it('drops a label and splits on commas outside parentheses', () => {
    expect(texts('przyprawy: sól, pieprz (czarny, mielony); papryka')).toEqual([
      'sól',
      'pieprz (czarny, mielony)',
      'papryka',
    ]);
  });

  it('marks parts optional when the label says so', () => {
    expect(splitIngredientLine('dodatki: kolendra, limonka').every((p) => p.optional)).toBe(true);
    expect(splitIngredientLine('przyprawy: sól')[0].optional).toBe(false);
  });

  it('splits on " i " only when an amount follows', () => {
    expect(texts('przyprawy: 1 łyżeczka soli i 1/3 łyżeczki pieprzu')).toEqual([
      '1 łyżeczka soli',
      '1/3 łyżeczki pieprzu',
    ]);
    expect(texts('przyprawy: sól i pieprz')).toEqual(['sól i pieprz']);
  });

  it('shares a trailing "po" amount', () => {
    expect(texts('chili i kumin po 1/4 łyżeczki')).toEqual(['1/4 łyżeczki chili', '1/4 łyżeczki kumin']);
  });

  it('shares a leading "po" amount', () => {
    expect(texts('po 0.5 łyżeczki papryki i oregano')).toEqual(['0.5 łyżeczki papryki', '0.5 łyżeczki oregano']);
  });

  it('shares an approximate unit', () => {
    expect(texts('szczypta soli i pieprzu')).toEqual(['szczypta soli', 'szczypta pieprzu']);
  });
});
