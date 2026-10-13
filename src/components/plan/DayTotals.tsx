import type { DayMacros } from '@/lib/day-macros';

/**
 * Macro total of one day. Nothing for a day without recipes; „brak danych makro" when no slot added macros.
 * When something was left out the sum is a lower bound, so it carries „makra niepełne" and a „≥" prefix
 * instead of reading as a real total.
 */
export function DayTotals({ day }: { day: DayMacros | undefined }) {
  if (!day) return null;
  if (!day.known) {
    return (
      <p className="text-xs text-muted" data-testid="day-totals">
        brak danych makro
      </p>
    );
  }
  const { kcal, protein, fat, carbs } = day.macros;
  return (
    <p className="text-xs tabular-nums text-ink" data-testid="day-totals">
      <span className="block font-semibold">{`${day.incomplete ? '≥ ' : ''}${Math.round(kcal)} kcal`}</span>
      <span className="block text-muted">
        B {Math.round(protein)} · T {Math.round(fat)} · W {Math.round(carbs)}
      </span>
      {day.incomplete && <span className="block text-muted">makra niepełne</span>}
    </p>
  );
}
