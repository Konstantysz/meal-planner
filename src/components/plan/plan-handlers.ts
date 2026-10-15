import type { PlanWithSlots } from '@/lib/db/plans';
import { isPendingSlot } from '@/lib/plan-slots';

/** Slot positions the desktop grid shows, and their names. */
export const POSITIONS = [0, 1, 2, 3, 4];
export const POSITION_LABELS = ['śniadanie', 'lunch', 'obiad', 'przekąska', 'kolacja'];

/** Callbacks the week views share; `WeekPlan` wires them to `usePlan`. */
export interface SlotHandlers {
  onAdd: (date: string, position: number) => void;
  onRemove: (slotId: string) => void;
  /** Moves a slot onto an empty (date, position). */
  onMove: (slotId: string, date: string, position: number) => void;
  onServingsChange: (slotId: string, servings: number) => void;
  /** Opens the "move to" picker for a slot. */
  onOpenMove: (slotId: string) => void;
  /** Plans a recipe (1 serving) into an empty (date, position). */
  onDropRecipe: (recipeId: string, date: string, position: number) => void;
}

/** A recipe as the week views need it: enough to show and to plan. */
export type PlanRecipe = { id: string; name: string };

/**
 * What `PlanSlot` needs for a planned slot. A pending slot (shown before the server created it) gets no handlers:
 * it has no row to PATCH or DELETE yet.
 */
export function slotProps(
  s: PlanWithSlots['slots'][number],
  h: Pick<SlotHandlers, 'onRemove' | 'onOpenMove' | 'onServingsChange'>,
) {
  const live = !isPendingSlot(s.id);
  return {
    recipeName: s.recipe?.name ?? (s.recipe_id ? 'przepis niedostępny' : null),
    servings: s.servings,
    onRemove: live ? () => h.onRemove(s.id) : undefined,
    onMove: live ? () => h.onOpenMove(s.id) : undefined,
    onServingsChange: live ? (n: number) => h.onServingsChange(s.id, n) : undefined,
  };
}
