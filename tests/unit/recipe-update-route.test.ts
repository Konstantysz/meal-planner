import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { getUser }, rpc }),
}));

const { PUT } = await import('@/app/api/recipes/[id]/route');

const body = {
  name: 'Zupa',
  servings_base: 2,
  prep_time_min: null,
  source_url: null,
  ingredients: [
    { ingredient_id: '3422d8ca-8907-49c2-8c83-da5fc298948f', amount: 1, unit: 'g', raw_text: 'a', position: 0 },
  ],
  steps: [{ position: 0, text: 'b' }],
};

const put = (payload: unknown) =>
  PUT(new Request('http://x/api/recipes/r1', { method: 'PUT', body: JSON.stringify(payload) }), {
    params: Promise.resolve({ id: 'r1' }),
  });

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } });
  rpc.mockReset();
});

describe('PUT /api/recipes/[id]', () => {
  it('updates and returns the recipe', async () => {
    rpc.mockResolvedValue({ data: { id: 'r1', name: 'Zupa' }, error: null });
    const res = await put(body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'r1', name: 'Zupa' });
    expect(rpc.mock.calls[0][0]).toBe('update_recipe');
    expect(rpc.mock.calls[0][1].p_recipe_id).toBe('r1');
  });

  it('returns 401 when signed out, without touching the database', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await put(body)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body, without touching the database', async () => {
    expect((await put({ ...body, steps: [] })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    const res = await PUT(new Request('http://x', { method: 'PUT', body: 'nope' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 (not a silent success) when RLS blocks the update', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'recipe not found or not editable' } });
    const res = await put(body);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBeTruthy();
  });

  it('returns 400 with the message for other database errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23503', message: 'foreign key violation' } });
    const res = await put(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('foreign key violation');
  });
});
