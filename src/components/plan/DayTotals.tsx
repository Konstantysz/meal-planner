import type { DayMacros } from '@/lib/day-macros';

/**
 * Macro total of one day. Nothing for a day without recipes; „brak danych makro" when any ingredient lacked
 * data (a partial sum would read as a real total).
 */
export function DayTotals({ day }: { day: DayMacros | undefined }) {
  if (!day) return null;
  if (day.incomplete) {
    return (
      <p className="text-xs text-faint" data-testid="day-totals">
        brak danych makro
      </p>
    );
  }
  const { kcal, protein, fat, carbs } = day.macros;
  return (
    <p className="text-xs tabular-nums text-ink" data-testid="day-totals">
      <span className="block font-semibold">{Math.round(kcal)} kcal</span>
      <span className="block text-muted">
        B {Math.round(protein)} · T {Math.round(fat)} · W {Math.round(carbs)}
      </span>
    </p>
  );
}
