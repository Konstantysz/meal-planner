import { describe, it, expect } from 'vitest';
import { generateShareToken } from '@/lib/share-token';

describe('generateShareToken', () => {
  it('returns 32-char url-safe string', () => {
    const t = generateShareToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
  it('is unique across calls', () => {
    const set = new Set(Array.from({ length: 100 }, generateShareToken));
    expect(set.size).toBe(100);
  });
});
