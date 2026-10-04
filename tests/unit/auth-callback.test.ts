import { describe, it, expect, vi, beforeEach } from 'vitest';

const exchangeCodeForSession = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { exchangeCodeForSession } }),
}));

const { GET } = await import('@/app/auth/callback/route');

const call = (query: string) => GET(new Request(`http://app.test/auth/callback${query}`));

beforeEach(() => exchangeCodeForSession.mockReset());

describe('GET /auth/callback', () => {
  it('exchanges the code and redirects to the new-password form', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await call('?code=abc');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(res.headers.get('location')).toBe('http://app.test/reset-password');
  });

  it('ignores a `next` param (no open redirect)', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await call('?code=abc&next=https://evil.test');
    expect(res.headers.get('location')).toBe('http://app.test/reset-password');
  });

  it('redirects to login with an error when the code is invalid', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });
    const res = await call('?code=bad');
    expect(res.headers.get('location')).toBe('http://app.test/login?error=link');
  });

  it('redirects to login with an error when the code is missing', async () => {
    const res = await call('');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe('http://app.test/login?error=link');
  });
});
