'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PlanWithSlots } from '@/lib/db/plans';
import type { PlanSlotPatch } from '@/lib/schemas';
import { applySlotPatch } from '@/lib/plan-slots';

export function usePlan(weekStart: string) {
  const [plan, setPlan] = useState<PlanWithSlots | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Not touching `loading` here: after the first load a reload swaps data in place instead of blanking the grid.
  const reload = useCallback(async () => {
    const r = await fetch(`/api/plans?week=${weekStart}`);
    if (r.ok) setPlan(await r.json());
    else setError('Nie udało się wczytać planu.');
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Runs a write; on failure shows `message` and reloads so the screen matches the server again. */
  async function write(request: () => Promise<Response>, message: string) {
    setError(null);
    const r = await request().catch(() => null);
    if (!r?.ok) setError(message);
    await reload();
  }

  async function assign(date: string, position: number, recipeId: string | null, servings: number) {
    if (!plan) return;
    await write(
      () =>
        fetch(`/api/plans/${plan.id}/slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, position, label: null, recipe_id: recipeId, servings }),
        }),
      'Nie udało się dodać posiłku.',
    );
  }

  async function remove(slotId: string) {
    if (!plan) return;
    await write(() => fetch(`/api/plans/${plan.id}/slots/${slotId}`, { method: 'DELETE' }), 'Nie udało się usunąć.');
  }

  /** Moves a slot and/or changes its servings (one PATCH); the screen updates before the server answers. */
  async function update(slotId: string, patch: PlanSlotPatch) {
    if (!plan) return;
    setPlan((p) => (p ? { ...p, slots: applySlotPatch(p.slots, slotId, patch) } : p));
    await write(
      () =>
        fetch(`/api/plans/${plan.id}/slots/${slotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }),
      patch.servings !== undefined && !patch.date && patch.position === undefined
        ? 'Nie udało się zmienić liczby porcji.'
        : 'Nie udało się przenieść posiłku (to miejsce może być zajęte).',
    );
  }

  return { plan, loading, error, assign, remove, update, reload };
}
