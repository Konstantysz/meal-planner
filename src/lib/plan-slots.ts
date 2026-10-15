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

const PENDING_PREFIX = 'pending:';

/** Id of a slot shown before the server has created it. */
export function pendingSlotId(date: string, position: number): string {
  return `${PENDING_PREFIX}${date}:${position}`;
}

/** True for a slot that exists only on screen: it has no row to PATCH or DELETE yet. */
export function isPendingSlot(slotId: string): boolean {
  return slotId.startsWith(PENDING_PREFIX);
}

/** Puts `slot` at its (date, position), replacing whatever occupied it, for optimistic adds. */
export function placeSlot<T extends Placed>(slots: T[], slot: T): T[] {
  return [...slots.filter((s) => s.date !== slot.date || s.position !== slot.position), slot];
}

/** For each date, the positions (from `positions`) that no slot occupies. */
export function freePositions(slots: Placed[], dates: string[], positions: number[]): Record<string, number[]> {
  const taken = new Set(slots.map((s) => `${s.date}:${s.position}`));
  return Object.fromEntries(dates.map((d) => [d, positions.filter((p) => !taken.has(`${d}:${p}`))]));
}
