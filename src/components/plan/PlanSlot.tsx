'use client';

export function PlanSlot({
  label, recipeName, onRemove,
}: { label: string; recipeName: string | null; onRemove?: () => void }) {
  return (
    <div className="border rounded p-2 bg-white text-sm min-h-[48px] flex justify-between items-start">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div>{recipeName ?? <span className="text-gray-400 italic">puste</span>}</div>
      </div>
      {onRemove && recipeName && (
        <button onClick={onRemove} className="text-red-600 text-xs">×</button>
      )}
    </div>
  );
}
