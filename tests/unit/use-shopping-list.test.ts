import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/offline/shopping-store', () => ({
  loadShoppingList: vi.fn().mockResolvedValue(undefined),
  saveShoppingList: vi.fn(),
  setHave: vi.fn(),
  getHaveMap: vi.fn().mockResolvedValue({}),
}));

import { useShoppingList } from '@/hooks/useShoppingList';

describe('useShoppingList', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stops loading when fetch rejects while navigator.onLine is true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { result } = renderHook(() => useShoppingList('2026-10-12'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });
});
