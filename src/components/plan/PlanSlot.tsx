'use client';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui';
import { servingsLabel } from '@/lib/servings-label';
import { slotClass } from './slot-colors';

const MAX_SERVINGS = 99;
const STEP =
  'grid min-h-11 min-w-11 place-items-center lg:min-h-6 lg:min-w-6 text-base leading-none disabled:opacity-40 hover:bg-hover rounded-control';
// On desktop the controls appear on hover or keyboard focus, so a filled block reads as just the recipe and its servings.
const REVEAL = 'lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100';
const ICON_BUTTON = 'grid min-h-11 min-w-11 place-items-center rounded-control hover:bg-hover lg:min-h-6 lg:min-w-6';

export function PlanSlot({
  label,
  position,
  recipeName,
  servings,
  onRemove,
  onMove,
  onServingsChange,
  dragHandle,
  showLabel = true,
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
  /** The desktop grid names the position in its row header, so its cells leave the label out. */
  showLabel?: boolean;
}) {
  const filled = !!recipeName;
  return (
    <div
      className={`flex h-full min-h-12 items-start gap-1 rounded-block px-2 py-1.5 text-sm ${slotClass(position, filled)}`}
    >
      {filled && dragHandle}
      <div className="min-w-0 flex-1">
        {showLabel && <div className={`text-xs ${filled ? 'text-on-slot' : 'text-muted'}`}>{label}</div>}
        <div className={`break-words leading-tight ${filled ? 'font-semibold' : ''}`}>
          {recipeName ?? <span className="italic text-muted">puste</span>}
        </div>
        {filled && servings !== undefined && onServingsChange && (
          <div className="mt-0.5 flex items-center text-xs text-on-slot" role="group" aria-label="Porcje">
            <button
              type="button"
              className={`${STEP} ${REVEAL}`}
              aria-label="Mniej porcji"
              disabled={servings <= 1}
              onClick={() => onServingsChange(servings - 1)}
            >
              −
            </button>
            <span className="min-w-14 text-center tabular-nums" aria-live="polite">
              {servingsLabel(servings)}
            </span>
            <button
              type="button"
              className={`${STEP} ${REVEAL}`}
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
        <div className={`flex flex-col items-center text-on-slot ${REVEAL}`}>
          {onMove && (
            <button type="button" onClick={onMove} aria-label="Przenieś posiłek" className={ICON_BUTTON}>
              <Icon name="move" width={16} height={16} />
            </button>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} aria-label="Usuń z planu" className={ICON_BUTTON}>
              <Icon name="close" width={16} height={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
