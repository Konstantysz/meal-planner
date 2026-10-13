/** Pure list edits shared by the step and ingredient-row editors (create form, import review). */

/** Returns a copy with the item at `idx` swapped with its neighbour (`dir` -1 up, 1 down); out of range is a no-op copy. */
export function moveItem<T>(list: readonly T[], idx: number, dir: -1 | 1): T[] {
  const target = idx + dir;
  const next = [...list];
  if (idx < 0 || idx >= list.length || target < 0 || target >= list.length) return next;
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

/** Returns a copy without the item at `idx`. */
export function removeItem<T>(list: readonly T[], idx: number): T[] {
  return list.filter((_, i) => i !== idx);
}
