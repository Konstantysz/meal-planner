import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeUnit, parseAmount } from '@/lib/import/ingredient-text';

describe('normalizeText', () => {
  it.each([
    ['1½ szklanki', '1.5 szklanki'],
    ['½ łyżeczki', '1/2 łyżeczki'],
    ['1 1/2 szklanki', '1.5 szklanki'],
    ['2 x 5 g', '10 g'],
    ['2-3 ząbki', '3 ząbki'],
    ['niecała szklanka', 'szklanka'],
    ['pół szklanki', '0.5 szklanki'],
    ['dwie łyżki', '2 łyżki'],
    ['kilka ząbków', '3 ząbków'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });

  it('leaves plain text alone', () => {
    expect(normalizeText('200 g mąki')).toBe('200 g mąki');
  });
});

describe('parseAmount', () => {
  it.each([
    ['200', 200],
    ['1,5', 1.5],
    ['1/4', 0.25],
    ['3 / 4', 0.75],
  ])('%s -> %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('returns null for a zero denominator and for non-numbers', () => {
    expect(parseAmount('1/0')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('normalizeUnit', () => {
  it.each([
    ['gramów', 'g'],
    ['litry', 'l'],
    ['szt', 'sztuki'],
    ['łyżeczki', 'łyżeczka'],
    ['łyżek', 'łyżka'],
    ['Szklanki', 'szklanka'],
    ['ząbków', 'ząbek'],
    ['szczypty', 'szczypta'],
    ['puszek', 'puszka'],
    ['ml', 'ml'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeUnit(input)).toBe(expected);
  });
});
