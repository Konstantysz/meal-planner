import type { Macros } from '@/lib/types';

export function MacroSummary({ macros }: { macros: Macros | null }) {
  if (!macros) return <span className="text-gray-400 text-sm">brak danych makro</span>;
  return (
    <span className="text-sm text-gray-700">
      {Math.round(macros.kcal)} kcal · B {macros.protein.toFixed(1)} · T {macros.fat.toFixed(1)} · W {macros.carbs.toFixed(1)}
    </span>
  );
}
