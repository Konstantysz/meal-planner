import { describe, it, expect } from 'vitest';
import { applySlotPatch, freePositions, isPendingSlot, pendingSlotId, placeSlot } from '@/lib/plan-slots';

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

describe('placeSlot', () => {
  const slot = (id: string, date: string, position: number) => ({ id, date, position });

  it('appends a slot for a free (date, position)', () => {
    const out = placeSlot([slot('a', '2026-10-12', 0)], slot('b', '2026-10-12', 1));
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('replaces the slot at the same (date, position)', () => {
    const out = placeSlot([slot('a', '2026-10-12', 0), slot('b', '2026-10-13', 0)], slot('c', '2026-10-12', 0));
    expect(out.map((s) => s.id)).toEqual(['b', 'c']);
  });
});

describe('pending slots', () => {
  it('recognises the id of a slot the server has not created yet', () => {
    expect(isPendingSlot(pendingSlotId('2026-10-12', 2))).toBe(true);
    expect(isPendingSlot('7b0c2d6e-5f43-4a8e-9d1b-2a6f3c4d5e60')).toBe(false);
  });
});
