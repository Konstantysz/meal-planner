import { describe, it, expect } from 'vitest';
import { applySlotPatch, freePositions } from '@/lib/plan-slots';

const slots = [
  { id: 'a', date: '2026-10-12', position: 0, servings: 1 },
  { id: 'b', date: '2026-10-12', position: 2, servings: 1 },
];

describe('applySlotPatch', () => {
  it('patches only the named slot', () => {
    const out = applySlotPatch(slots, 'a', { date: '2026-10-13', servings: 3 });
    expect(out[0]).toEqual({ id: 'a', date: '2026-10-13', position: 0, servings: 3 });
    expect(out[1]).toBe(slots[1]);
  });
});

describe('freePositions', () => {
  it('lists the unoccupied positions per date', () => {
    expect(freePositions(slots, ['2026-10-12', '2026-10-13'], [0, 1, 2])).toEqual({
      '2026-10-12': [1],
      '2026-10-13': [0, 1, 2],
    });
  });
});
