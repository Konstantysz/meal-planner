import { describe, it, expect, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect }));

import Home from '@/app/page';

describe('/', () => {
  it('redirects to the plan', () => {
    Home();
    expect(redirect).toHaveBeenCalledWith('/plan');
  });
});
