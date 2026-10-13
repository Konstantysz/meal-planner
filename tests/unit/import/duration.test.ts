import { describe, it, expect } from 'vitest';
import { parsePrepMinutes } from '@/lib/import/duration';

describe('parsePrepMinutes', () => {
  it.each([
    ['PT20M', 20],
    ['PT1H30M', 90],
    ['PT45M', 45],
    ['PT2H', 120],
    ['P1DT1H', 1500],
    ['pt15m', 15],
    ['PT90S', 2],
  ])('%j → %j', (input, expected) => {
    expect(parsePrepMinutes(input)).toBe(expected);
  });

  it.each([['PT0M'], ['P'], ['PT'], ['20 min'], ['about an hour'], ['PT-5M'], ['PT1.5H'], [''], [undefined]])(
    '%j → null',
    (input) => {
      expect(parsePrepMinutes(input)).toBeNull();
    },
  );
});
