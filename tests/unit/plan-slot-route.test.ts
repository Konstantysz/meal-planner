import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable stand-in for the Supabase query builder; `result` is what the final maybeSingle() resolves to.
const calls: Array<[string, unknown[]]> = [];
let result: { data: unknown; error: { code: string } | null };
const builder: Record<string, unknown> = {};
for (const m of ['from', 'update', 'eq', 'select']) {
  builder[m] = (...args: unknown[]) => {
    calls.push([m, args]);
    return builder;
  };
}
builder.maybeSingle = () => Promise.resolve(result);

vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => builder }));

const { PATCH } = await import('@/app/api/plans/[id]/slots/[slotId]/route');

const patch = (body: unknown) =>
  PATCH(new Request('http://x/api/plans/p1/slots/s1', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'p1', slotId: 's1' }),
  });

beforeEach(() => {
  calls.length = 0;
  result = { data: { id: 's1', date: '2026-10-14', position: 1, servings: 2 }, error: null };
});

describe('PATCH /api/plans/[id]/slots/[slotId]', () => {
  it('moves and rescales a slot in one UPDATE scoped to the plan', async () => {
    const res = await patch({ date: '2026-10-14', position: 1, servings: 2 });
    expect(res.status).toBe(200);
    expect((await res.json()).servings).toBe(2);
    expect(calls.filter(([m]) => m === 'update')).toEqual([
      ['update', [{ date: '2026-10-14', position: 1, servings: 2 }]],
    ]);
    expect(calls).toContainEqual(['eq', ['id', 's1']]);
    expect(calls).toContainEqual(['eq', ['plan_id', 'p1']]);
  });

  it('accepts servings alone', async () => {
    expect((await patch({ servings: 4 })).status).toBe(200);
    expect(calls.find(([m]) => m === 'update')?.[1]).toEqual([{ servings: 4 }]);
  });

  it.each([
    ['an empty body', {}],
    ['a bad date', { date: '14.10.2026' }],
    ['zero servings', { servings: 0 }],
    ['a negative position', { position: -1 }],
    ['fields that are not patchable', { recipe_id: null }],
  ])('rejects %s with 400 and writes nothing', async (_n, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(calls.some(([m]) => m === 'update')).toBe(false);
  });

  it('returns 409 when the target slot is occupied (unique violation)', async () => {
    result = { data: null, error: { code: '23505' } };
    expect((await patch({ position: 1 })).status).toBe(409);
  });

  it('returns 404 when no row matched (missing, other plan, or hidden by RLS)', async () => {
    result = { data: null, error: null };
    expect((await patch({ position: 1 })).status).toBe(404);
  });

  it('returns 400 on other database errors', async () => {
    result = { data: null, error: { code: '42501' } };
    expect((await patch({ position: 1 })).status).toBe(400);
  });
});
