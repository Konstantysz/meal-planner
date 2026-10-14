import { addDays, addWeeks, format, isValid, parse, startOfWeek } from 'date-fns';

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

/** The Sunday closing the week that starts on `weekStart` (inclusive end of the plan window). */
export function weekEndOf(weekStart: string): string {
  return format(addDays(parse(weekStart, 'yyyy-MM-dd', new Date()), 6), 'yyyy-MM-dd');
}

/** The seven days of the week starting on `weekStart`, as local-midnight dates (never `new Date(yyyy-MM-dd)`, which is UTC). */
export function weekDays(weekStart: string): Date[] {
  const start = parse(weekStart, 'yyyy-MM-dd', new Date());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** „12–18 października", „28 września – 4 października"; the year only when the week crosses New Year. */
export function weekRange(weekStart: string): string {
  const [from, , , , , , to] = weekDays(weekStart);
  const year = from.getFullYear() === to.getFullYear() ? {} : { year: 'numeric' as const };
  return new Intl.DateTimeFormat('pl', { day: 'numeric', month: 'long', ...year }).formatRange(from, to);
}
