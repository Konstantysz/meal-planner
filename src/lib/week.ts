import { format, isValid, parse, startOfWeek } from 'date-fns';

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
