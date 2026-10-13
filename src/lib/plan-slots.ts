import type { PlanSlotPatch } from '@/lib/schemas';

interface Placed {
  id: string;
  date: string;
  position: number;
}

/** Applies a PATCH body to the slot with `slotId`, for optimistic updates. Other slots are returned as they are. */
export function applySlotPatch<T extends Placed & { servings: number }>(
  slots: T[],
  slotId: string,
  patch: PlanSlotPatch,
): T[] {
  return slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s));
}

/** For each date, the positions (from `positions`) that no slot occupies. */
export function freePositions(slots: Placed[], dates: string[], positions: number[]): Record<string, number[]> {
  const taken = new Set(slots.map((s) => `${s.date}:${s.position}`));
  return Object.fromEntries(dates.map((d) => [d, positions.filter((p) => !taken.has(`${d}:${p}`))]));
}
