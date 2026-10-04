import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSharedPlan } from '@/lib/db/share';

function mockRpc(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const plan = {
  week_start_date: '2026-09-28',
  slots: [
    {
      id: '6f1c0d52-3b9e-4c55-9a43-2f0b8c1d7e10',
      date: '2026-10-04',
      position: 2,
      label: 'obiad',
      servings: 1,
      recipe: { name: 'Spaghetti' },
    },
    {
      id: '0b7a1e3c-58d2-4f6a-8c19-7d4e2a9b3f21',
      date: '2026-10-04',
      position: 3,
      label: null,
      servings: 2,
      recipe: null,
    },
  ],
};

describe('getSharedPlan', () => {
  it('calls the get_shared_plan RPC with the token and returns the parsed plan', async () => {
    const { client, rpc } = mockRpc({ data: plan, error: null });
    await expect(getSharedPlan(client, 'tok')).resolves.toEqual(plan);
    expect(rpc).toHaveBeenCalledWith('get_shared_plan', { p_token: 'tok' });
  });

  it('returns null for an unknown token', async () => {
    const { client } = mockRpc({ data: null, error: null });
    await expect(getSharedPlan(client, 'nope')).resolves.toBeNull();
  });

  it('throws the RPC error', async () => {
    const error = { message: 'boom' };
    const { client } = mockRpc({ data: null, error });
    await expect(getSharedPlan(client, 'tok')).rejects.toBe(error);
  });

  it('rejects a payload that does not match the schema', async () => {
    const { client } = mockRpc({ data: { week_start_date: '2026-09-28', slots: [{ id: 'x' }] }, error: null });
    await expect(getSharedPlan(client, 'tok')).rejects.toThrow();
  });
});
