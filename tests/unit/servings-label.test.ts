import { describe, it, expect } from 'vitest';
import { servingsLabel } from '@/lib/servings-label';

describe('servingsLabel', () => {
  it.each([
    [1, '1 porcja'],
    [2, '2 porcje'],
    [4, '4 porcje'],
    [5, '5 porcji'],
    [12, '12 porcji'],
    [14, '14 porcji'],
    [22, '22 porcje'],
    [99, '99 porcji'],
  ])('%i → %s', (n, expected) => {
    expect(servingsLabel(n)).toBe(expected);
  });
});
