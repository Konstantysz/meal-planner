import { describe, it, expect } from 'vitest';
import { normalizeUnit } from '@/lib/import/unit';

describe('normalizeUnit', () => {
  it.each([
    ['gramów', 'g'],
    ['łyżek', 'łyżka'],
    ['łyżeczki', 'łyżeczka'],
    ['ząbki', 'ząbek'],
    ['Szczypta', 'szczypta'],
    ['ml', 'ml'],
  ])('%s -> %s', (input, want) => {
    expect(normalizeUnit(input)).toBe(want);
  });
});
