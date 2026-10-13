import { describe, it, expect, vi, beforeEach } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect }));

import Home from '@/app/page';

beforeEach(() => redirect.mockClear());

describe('/', () => {
  it('redirects to the plan', async () => {
    await Home({ searchParams: Promise.resolve({}) });
    expect(redirect).toHaveBeenCalledWith('/plan');
  });

  it('keeps ?week=', async () => {
    await Home({ searchParams: Promise.resolve({ week: '2026-10-12' }) });
    expect(redirect).toHaveBeenCalledWith('/plan?week=2026-10-12');
  });
});
