import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAppAdmin } from '@/lib/db/app-admins';

function mockRpc(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe('isAppAdmin', () => {
  it('asks the is_app_admin RPC', async () => {
    const { client, rpc } = mockRpc({ data: true, error: null });
    await expect(isAppAdmin(client)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('is_app_admin');
  });

  it('is false for a non-admin', async () => {
    await expect(isAppAdmin(mockRpc({ data: false, error: null }).client)).resolves.toBe(false);
  });

  it('treats an error as not an admin', async () => {
    await expect(isAppAdmin(mockRpc({ data: null, error: { code: '42501' } }).client)).resolves.toBe(false);
  });
});
