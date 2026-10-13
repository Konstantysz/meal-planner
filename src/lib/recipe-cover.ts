/**
 * Slot position a recipe cover takes its colour from (design brief, "Slot colours"): the position it is
 * most often planned in; on a tie the most recently planned one wins. Null when it was never planned.
 */
export function coverPosition(slots: Array<{ position: number; date: string }>): number | null {
  const stats = new Map<number, { count: number; latest: string }>();
  for (const s of slots) {
    const cur = stats.get(s.position);
    if (!cur) stats.set(s.position, { count: 1, latest: s.date });
    else stats.set(s.position, { count: cur.count + 1, latest: s.date > cur.latest ? s.date : cur.latest });
  }
  let best: { position: number; count: number; latest: string } | null = null;
  for (const [position, v] of stats) {
    if (!best || v.count > best.count || (v.count === best.count && v.latest > best.latest)) {
      best = { position, ...v };
    }
  }
  return best?.position ?? null;
}
