import { addWeeks, format, isValid, parse, startOfWeek } from 'date-fns';

/** Monday of the week containing `date`, as yyyy-MM-dd (plans are keyed by it; DB enforces Monday). */
export function weekStartOf(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/** Normalizes any yyyy-MM-dd to its week's Monday. Returns null for malformed input. */
export function normalizeWeekStart(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parse(value, 'yyyy-MM-dd', new Date());
  if (!isValid(date) || format(date, 'yyyy-MM-dd') !== value) return null;
  return weekStartOf(date);
}

/** The Monday `weeks` weeks after (or before, when negative) `weekStart`. */
export function shiftWeek(weekStart: string, weeks: number): string {
  return format(addWeeks(parse(weekStart, 'yyyy-MM-dd', new Date()), weeks), 'yyyy-MM-dd');
}

/** Week for a `?week=` value: its Monday, or the current week when missing or malformed. */
export function resolveWeek(param: string | string[] | undefined, now: Date): string {
  const value = Array.isArray(param) ? param[0] : param;
  return (value ? normalizeWeekStart(value) : null) ?? weekStartOf(now);
}
