'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanWithSlots } from '@/lib/db/plans';
import type { PlanSlotPatch } from '@/lib/schemas';
import { applySlotPatch, isPendingSlot, pendingSlotId, placeSlot } from '@/lib/plan-slots';

export function usePlan(weekStart: string) {
  const [plan, setPlan] = useState<PlanWithSlots | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only the newest reload may set the plan: an older response arriving late would undo a newer optimistic change.
  const latestReload = useRef(0);

  // Not touching `loading` here: after the first load a reload swaps data in place instead of blanking the grid.
  // Returns false when the plan could not be fetched. A reload that was superseded counts as fine: a newer one answers.
  const reload = useCallback(async () => {
    const mine = ++latestReload.current;
    const r = await fetch(`/api/plans?week=${weekStart}`).catch(() => null);
    if (mine !== latestReload.current) return true;
    if (r?.ok) setPlan(await r.json());
    // Keep a failed write's message: it says more than "could not load".
    else setError((e) => e ?? 'Nie udało się wczytać planu.');
    setLoading(false);
    return !!r?.ok;
  }, [weekStart]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Runs a write; on failure shows `message`. Reloads either way so the screen matches the server again. */
  async function write(request: () => Promise<Response>, message: string) {
    setError(null);
    const r = await request().catch(() => null);
    const ok = !!r?.ok;
    if (!ok) setError(message);
    return { ok, reloaded: await reload() };
  }

  /**
   * Plans a recipe into a slot. With `recipe` (id and name) the slot shows at once, before the server answers; its
   * macros stay unknown until the reload brings the full recipe.
   */
  async function assign(
    date: string,
    position: number,
    recipeId: string | null,
    servings: number,
    recipe?: { id: string; name: string },
  ) {
    if (!plan) return;
    const pendingId = pendingSlotId(date, position);
    // What the optimistic slot replaces, to put back if the write fails.
    const replaced = plan.slots.find((s) => s.date === date && s.position === position);
    if (recipe) {
      // Invalidate reloads already in flight: their answer predates this slot and would wipe it.
      latestReload.current++;
      const pending: PlanWithSlots['slots'][number] = {
        id: pendingId,
        plan_id: plan.id,
        date,
        position,
        label: null,
        recipe_id: recipe.id,
        servings,
        recipe: { id: recipe.id, name: recipe.name, servings_base: servings, ingredients: [] },
      };
      setPlan((p) => (p ? { ...p, slots: placeSlot(p.slots, pending) } : p));
    }
    const { ok, reloaded } = await write(
      () =>
        fetch(`/api/plans/${plan.id}/slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, position, label: null, recipe_id: recipeId, servings }),
        }),
      'Nie udało się dodać posiłku.',
    );
    // Only when the reload failed too (offline): otherwise the server's answer already replaced the optimistic slot.
    if (!ok && !reloaded && recipe) {
      setPlan((p) => {
        if (!p) return p;
        const rest = p.slots.filter((s) => s.id !== pendingId);
        return { ...p, slots: replaced && !rest.some((s) => s.id === replaced.id) ? [...rest, replaced] : rest };
      });
    }
  }

  async function remove(slotId: string) {
    if (!plan || isPendingSlot(slotId)) return;
    await write(() => fetch(`/api/plans/${plan.id}/slots/${slotId}`, { method: 'DELETE' }), 'Nie udało się usunąć.');
  }

  /** Moves a slot and/or changes its servings (one PATCH); the screen updates before the server answers. */
  async function update(slotId: string, patch: PlanSlotPatch) {
    if (!plan || isPendingSlot(slotId)) return;
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
