import { describe, it, expect } from 'vitest';
import { parseYield } from '@/lib/import/yield';

describe('parseYield', () => {
  it.each([
    [undefined, 4],
    ['', 4],
    [3.6, 4],
    [0, 1],
    ['4 porcje', 4],
    ['na 6 osób', 6],
    ['12 sztuk', 12],
    // Explicit count wins over a weight in the same string.
    ['4 porcje po 250 g', 4],
    ['4 porcje (ok. 1,2 kg)', 4],
    // Weight only → grams / 350.
    ['1,5 kg', 4],
    ['700 g', 2],
    ['500 gramów', 1],
    ['2 garście', 2],
    ['bez liczby', 4],
  ])('%j → %i', (input, expected) => {
    expect(parseYield(input as string | number | undefined)).toBe(expected);
  });
});
