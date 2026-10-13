import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable stand-in for the Supabase query builder; `result` is what the final maybeSingle() resolves to.
const calls: Array<[string, unknown[]]> = [];
let planResult: { data: unknown; error: { code: string } | null };
let table = '';
let result: { data: unknown; error: { code: string } | null };
const builder: Record<string, unknown> = {};
for (const m of ['from', 'update', 'eq', 'select']) {
  builder[m] = (...args: unknown[]) => {
    if (m === 'from') table = String(args[0]);
    calls.push([m, args]);
    return builder;
  };
}
builder.maybeSingle = () => Promise.resolve(table === 'plans' ? planResult : result);

vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: async () => builder }));

const { PATCH } = await import('@/app/api/plans/[id]/slots/[slotId]/route');

const patch = (body: unknown) =>
  PATCH(new Request('http://x/api/plans/p1/slots/s1', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'p1', slotId: 's1' }),
  });

beforeEach(() => {
  calls.length = 0;
  planResult = { data: { week_start_date: '2026-10-12' }, error: null };
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

  it.each([['2026-10-11'], ['2026-10-19'], ['2026-11-30']])(
    'rejects date %s outside the plan week with 400',
    async (date) => {
      expect((await patch({ date })).status).toBe(400);
      expect(calls.some(([m]) => m === 'update')).toBe(false);
    },
  );

  it.each([['2026-10-12'], ['2026-10-18']])('accepts the week edge %s', async (date) => {
    expect((await patch({ date })).status).toBe(200);
  });

  it('rejects an impossible calendar date without touching the database', async () => {
    expect((await patch({ date: '2026-02-30' })).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('returns 404 when the plan is not visible', async () => {
    planResult = { data: null, error: null };
    expect((await patch({ date: '2026-10-14' })).status).toBe(404);
  });

  it('returns a generic 500 on other database errors and logs the details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    result = { data: null, error: { code: '42501', message: 'secret constraint plan_slots_x' } as never };
    const res = await patch({ position: 1 });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
