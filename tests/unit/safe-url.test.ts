import { describe, it, expect } from 'vitest';
import { isHttpUrl, safeHttpUrl } from '@/lib/safe-url';

describe('safeHttpUrl', () => {
  it('passes http and https', () => {
    expect(safeHttpUrl('https://a.pl/x')).toBe('https://a.pl/x');
    expect(isHttpUrl('http://a.pl')).toBe(true);
  });
  it('drops other schemes, garbage and empty values', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,x')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
  });
});
