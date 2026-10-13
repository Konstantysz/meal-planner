'use client';
import { slotClass } from './slot-colors';

export function PlanSlot({
  label,
  position,
  recipeName,
  onRemove,
}: {
  label: string;
  position: number;
  recipeName: string | null;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`rounded-block p-2 text-sm min-h-12 flex justify-between items-start ${slotClass(position, !!recipeName)}`}
    >
      <div>
        <div className={`text-xs ${recipeName ? 'text-on-slot' : 'text-muted'}`}>{label}</div>
        <div>{recipeName ?? <span className="text-faint italic">puste</span>}</div>
      </div>
      {onRemove && recipeName && (
        <button
          onClick={onRemove}
          aria-label="Usuń z planu"
          className="text-xs text-on-slot min-w-11 min-h-11 lg:min-w-6 lg:min-h-6"
        >
          ×
        </button>
      )}
    </div>
  );
}
