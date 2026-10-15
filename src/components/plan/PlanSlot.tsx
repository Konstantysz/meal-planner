'use client';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui';
import { servingsLabel } from '@/lib/servings-label';
import { slotClass } from './slot-colors';

const MAX_SERVINGS = 99;
// Shared by the − / + stepper and the move / remove icons.
const CONTROL =
  'grid min-h-11 min-w-11 place-items-center rounded-control leading-none hover:bg-hover disabled:opacity-40 lg:min-h-6 lg:min-w-6';
// Where there is a mouse and room (`hover-desktop`, globals.css) the controls appear on hover or keyboard focus, so a filled
// block reads as just the recipe and its servings. Touch devices and phones always see them.
const REVEAL =
  'hover-desktop:opacity-0 hover-desktop:group-hover:opacity-100 hover-desktop:group-focus-within:opacity-100';

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
  /** Left out where the row header already names the position (desktop grid). */
  label?: string;
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
    <div
      className={`group flex h-full min-h-12 items-start gap-1 rounded-block px-2 py-1.5 text-sm ${slotClass(position, filled)} ${filled ? 'hover-desktop:hover:outline hover-desktop:hover:outline-2 hover-desktop:hover:-outline-offset-2 hover-desktop:hover:outline-ink/40' : ''}`}
    >
      {filled && dragHandle && <span className={REVEAL}>{dragHandle}</span>}
      <div className="min-w-0 flex-1">
        {label && <div className={`text-xs ${filled ? 'text-on-slot' : 'text-muted'}`}>{label}</div>}
        <div className={`break-words leading-tight ${filled ? 'font-semibold' : ''}`}>
          {recipeName ?? <span className="italic text-muted">puste</span>}
        </div>
        {filled && servings !== undefined && onServingsChange && (
          <div className="mt-0.5 flex items-center text-xs text-on-slot" role="group" aria-label="Porcje">
            <button
              type="button"
              className={`${CONTROL} ${REVEAL} text-base`}
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
              className={`${CONTROL} ${REVEAL} text-base`}
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
            <button type="button" onClick={onMove} aria-label="Przenieś posiłek" className={CONTROL}>
              <Icon name="move" width={16} height={16} />
            </button>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} aria-label="Usuń z planu" className={CONTROL}>
              <Icon name="close" width={16} height={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
