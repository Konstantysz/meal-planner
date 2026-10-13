import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const rpc = vi.fn();
const select = vi.fn();
const from = vi.fn(() => ({ delete: () => ({ eq: () => ({ select }) }) }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { getUser }, rpc, from }),
}));

const { POST } = await import('@/app/api/recipes/[id]/fork/route');
const { DELETE } = await import('@/app/api/recipes/[id]/route');

const FORK = '0b6f3f4e-1f7e-4a53-9f43-2b8d0e8f6a11';
const ctx = { params: Promise.resolve({ id: 'r1' }) };
const fork = () => POST(new Request('http://x/api/recipes/r1/fork', { method: 'POST' }), ctx);
const del = () => DELETE(new Request('http://x/api/recipes/r1', { method: 'DELETE' }), ctx);

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u2' } } });
  rpc.mockReset();
  select.mockReset();
  from.mockClear();
});

describe('POST /api/recipes/[id]/fork', () => {
  it('forks and returns the fork id with 201', async () => {
    rpc.mockResolvedValue({ data: FORK, error: null });
    const res = await fork();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: FORK });
    expect(rpc).toHaveBeenCalledWith('fork_recipe', { p_recipe_id: 'r1' });
  });

  it('returns 401 when signed out, without touching the database', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await fork()).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 404 for a recipe the caller cannot read (P0002)', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'recipe not found' } });
    expect((await fork()).status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22P02', message: 'invalid input syntax' } });
    expect((await fork()).status).toBe(400);
  });

  it('returns 500 with a generic message and logs for unknown database errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'relation "secret" exploded' } });
    const res = await fork();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('DELETE /api/recipes/[id]', () => {
  it('returns 204 when the recipe was deleted', async () => {
    select.mockResolvedValue({ data: [{ id: 'r1' }], error: null });
    expect((await del()).status).toBe(204);
    expect(from).toHaveBeenCalledWith('recipes');
  });

  it('returns 403 (not a silent 204) when RLS filters the delete', async () => {
    select.mockResolvedValue({ data: [], error: null });
    const res = await del();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('brak dostępu do przepisu');
  });

  it('returns 401 when signed out, without touching the database', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await del()).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 500 with a generic message for unknown database errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    select.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'secret detail' } });
    const res = await del();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    log.mockRestore();
  });
});
