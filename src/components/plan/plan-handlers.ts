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
