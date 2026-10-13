import { describe, it, expect, vi, beforeEach } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect }));

import Home from '@/app/page';

beforeEach(() => redirect.mockClear());

describe('/', () => {
  it('redirects to the recipes list, the start screen', () => {
    Home();
    expect(redirect).toHaveBeenCalledWith('/recipes');
  });
});
