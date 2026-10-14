import type { Macros } from '@/lib/types';

export function MacroSummary({ macros }: { macros: Macros | null }) {
  if (!macros) return <span className="text-sm text-muted">brak danych makro</span>;
  return (
    <span className="text-sm tabular-nums text-ink">
      {Math.round(macros.kcal)} kcal · B {macros.protein.toFixed(1)} · T {macros.fat.toFixed(1)} · W{' '}
      {macros.carbs.toFixed(1)}
    </span>
  );
}
