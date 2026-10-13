import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SlotNotFoundError, SlotOccupiedError, updateSlot } from '@/lib/db/plans';

function client(result: { data: unknown; error: { code: string } | null }, spy: unknown[] = []) {
  const q: Record<string, unknown> = {};
  for (const m of ['from', 'update', 'eq', 'select']) q[m] = (...a: unknown[]) => (spy.push([m, ...a]), q);
  q.maybeSingle = async () => result;
  return q as unknown as SupabaseClient;
}

describe('updateSlot', () => {
  it('issues one UPDATE filtered by slot and plan', async () => {
    const spy: unknown[] = [];
    const slot = { id: 's1', servings: 3 };
    const out = await updateSlot(client({ data: slot, error: null }, spy), 'p1', 's1', { servings: 3 });
    expect(out).toBe(slot);
    expect(spy).toEqual([
      ['from', 'plan_slots'],
      ['update', { servings: 3 }],
      ['eq', 'id', 's1'],
      ['eq', 'plan_id', 'p1'],
      ['select'],
    ]);
  });

  it('maps a unique violation to SlotOccupiedError and no row to SlotNotFoundError', async () => {
    await expect(
      updateSlot(client({ data: null, error: { code: '23505' } }), 'p', 's', { position: 1 }),
    ).rejects.toBeInstanceOf(SlotOccupiedError);
    await expect(updateSlot(client({ data: null, error: null }), 'p', 's', { position: 1 })).rejects.toBeInstanceOf(
      SlotNotFoundError,
    );
  });
});
