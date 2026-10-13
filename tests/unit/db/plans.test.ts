import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SlotNotFoundError, SlotOccupiedError, getWeekPlan, getWeekPlanWithMacros, updateSlot } from '@/lib/db/plans';

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

function planClient(data: unknown, spy: string[] = []) {
  const q: Record<string, unknown> = {};
  q.from = () => q;
  q.select = (cols: string) => (spy.push(cols), q);
  q.eq = () => q;
  q.single = async () => ({ data, error: null });
  return q as unknown as SupabaseClient;
}

describe('getWeekPlan / getWeekPlanWithMacros', () => {
  it('getWeekPlan selects no ingredient columns', async () => {
    const spy: string[] = [];
    await getWeekPlan(planClient({ id: 'p', slots: [] }, spy), 'p');
    expect(spy[0]).not.toContain('recipe_ingredients');
  });

  it('getWeekPlanWithMacros defaults missing ingredients to [] and keeps null recipes', async () => {
    const spy: string[] = [];
    const raw = {
      id: 'p',
      slots: [
        { id: 'a', recipe: { id: 'r', name: 'x', servings_base: 2 } },
        { id: 'b', recipe: { id: 'r', name: 'x', servings_base: 2, ingredients: [{ amount: 1 }] } },
        { id: 'c', recipe: null },
      ],
    };
    const out = await getWeekPlanWithMacros(planClient(raw, spy), 'p');
    expect(spy[0]).toContain('kcal_per_100g');
    expect(out.slots[0].recipe?.ingredients).toEqual([]);
    expect(out.slots[1].recipe?.ingredients).toHaveLength(1);
    expect(out.slots[2].recipe).toBeNull();
  });
});
