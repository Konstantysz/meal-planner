import { describe, it, expect } from 'vitest';
import { normalizeUnit, UNITS } from '@/lib/import/unit';

describe('UNITS', () => {
  it.each(UNITS)('%s is canonical', (u) => expect(normalizeUnit(u)).toBe(u));
});

describe('normalizeUnit', () => {
  it.each([
    ['gramów', 'g'],
    ['łyżek', 'łyżka'],
    ['łyżeczki', 'łyżeczka'],
    ['ząbki', 'ząbek'],
    ['ząb', 'ząbek'],
    ['Szczypta', 'szczypta'],
    ['ml', 'ml'],
    // gemma2 puts the modifier (or a fraction) in front of the unit; the unit is the last word.
    ['płaska łyżeczka', 'łyżeczka'],
    ['czubate łyżki', 'łyżka'],
    ['1/3 łyżeczki', 'łyżeczka'],
    // ...and sometimes a qualifier after it; tablespoon (15 ml) and teaspoon (5 ml) must stay apart.
    ['łyżka stołowa', 'łyżka'],
    ['łyżeczka do herbaty', 'łyżeczka'],
  ])('%s -> %s', (input, want) => {
    expect(normalizeUnit(input)).toBe(want);
  });

  it.each(['składki', 'listków', 'średnie', 'cm'])('%s -> null (not a stored unit)', (input) => {
    expect(normalizeUnit(input)).toBeNull();
  });
});
