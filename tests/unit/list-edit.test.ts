import { describe, it, expect } from 'vitest';
import { moveItem, removeItem } from '@/lib/list-edit';

describe('moveItem', () => {
  it('swaps with the next item going down', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });
  it('swaps with the previous item going up', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
  });
  it('returns an unchanged copy at the edges and out of range', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(list, 1, 1)).toEqual(['a', 'b']);
    expect(moveItem(list, 5, -1)).toEqual(['a', 'b']);
    expect(moveItem(list, 0, 1)).not.toBe(list);
  });
  it('does not mutate the input', () => {
    const list = ['a', 'b'];
    moveItem(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('removeItem', () => {
  it('removes the item at the index', () => {
    expect(removeItem(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });
  it('ignores an out-of-range index', () => {
    expect(removeItem(['a'], 3)).toEqual(['a']);
  });
});
