'use client';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui';
import { slotClass } from './slot-colors';

const MAX_SERVINGS = 99;
const STEP =
  'min-h-11 min-w-11 lg:min-h-6 lg:min-w-6 text-base leading-none disabled:opacity-40 hover:bg-hover rounded-control';

export function PlanSlot({
  label,
  position,
  recipeName,
  servings,
  onRemove,
  onMove,
  onServingsChange,
  dragHandle,
}: {
  label: string;
  position: number;
  recipeName: string | null;
  servings?: number;
  onRemove?: () => void;
  /** Opens the "move to" picker: the keyboard and touch alternative to dragging. */
  onMove?: () => void;
  onServingsChange?: (servings: number) => void;
  /** Desktop only: the element that starts a drag. */
  dragHandle?: ReactNode;
}) {
  const filled = !!recipeName;
  return (
    <div className={`rounded-block p-2 text-sm min-h-12 flex gap-1 items-start ${slotClass(position, filled)}`}>
      {filled && dragHandle}
      <div className="min-w-0 flex-1">
        <div className={`text-xs ${filled ? 'text-on-slot' : 'text-muted'}`}>{label}</div>
        <div className="break-words">{recipeName ?? <span className="text-muted italic">puste</span>}</div>
        {filled && servings !== undefined && onServingsChange && (
          <div className="mt-1 flex items-center gap-1 text-xs text-on-slot" role="group" aria-label="Porcje">
            <button
              type="button"
              className={STEP}
              aria-label="Mniej porcji"
              disabled={servings <= 1}
              onClick={() => onServingsChange(servings - 1)}
            >
              −
            </button>
            <span className="min-w-12 text-center tabular-nums" aria-live="polite">
              {servings} {servings === 1 ? 'porcja' : 'porcji'}
            </span>
            <button
              type="button"
              className={STEP}
              aria-label="Więcej porcji"
              disabled={servings >= MAX_SERVINGS}
              onClick={() => onServingsChange(servings + 1)}
            >
              +
            </button>
          </div>
        )}
      </div>
      {filled && (onMove || onRemove) && (
        <div className="flex flex-col items-center text-on-slot">
          {onMove && (
            <button
              type="button"
              onClick={onMove}
              aria-label="Przenieś posiłek"
              className="grid min-h-11 min-w-11 place-items-center rounded-control hover:bg-hover lg:min-h-6 lg:min-w-6"
            >
              <Icon name="move" width={16} height={16} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Usuń z planu"
              className="text-xs min-w-11 min-h-11 lg:min-w-6 lg:min-h-6"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
