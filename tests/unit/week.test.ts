import { describe, it, expect } from 'vitest';
import { normalizeWeekStart, resolveWeek, shiftWeek, weekEndOf, weekStartOf } from '@/lib/week';

describe('weekStartOf', () => {
  it('returns the Monday for every day of the week', () => {
    // 2026-09-28 is a Monday, 2026-10-04 a Sunday
    for (let d = 28; d <= 30; d++) expect(weekStartOf(new Date(2026, 8, d))).toBe('2026-09-28');
    for (let d = 1; d <= 4; d++) expect(weekStartOf(new Date(2026, 9, d))).toBe('2026-09-28');
  });

  it('starts a new week on Monday', () => {
    expect(weekStartOf(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
});

describe('shiftWeek', () => {
  it('moves by whole weeks across month and year ends', () => {
    expect(shiftWeek('2026-10-12', 1)).toBe('2026-10-19');
    expect(shiftWeek('2026-10-12', -2)).toBe('2026-09-28');
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04');
  });
});

describe('resolveWeek', () => {
  const now = new Date(2026, 9, 14); // Wednesday
  it('normalizes a valid ?week= to its Monday', () => {
    expect(resolveWeek('2026-10-04', now)).toBe('2026-09-28');
    expect(resolveWeek(['2026-10-12', 'x'], now)).toBe('2026-10-12');
  });
  it('falls back to the current week when missing or malformed', () => {
    expect(resolveWeek(undefined, now)).toBe('2026-10-12');
    expect(resolveWeek('nonsense', now)).toBe('2026-10-12');
    expect(resolveWeek('2026-02-31', now)).toBe('2026-10-12');
  });
});

describe('normalizeWeekStart', () => {
  it('maps a Sunday to the preceding Monday (the settings-page bug)', () => {
    expect(normalizeWeekStart('2026-10-04')).toBe('2026-09-28');
  });

  it('keeps a Monday as is', () => {
    expect(normalizeWeekStart('2026-09-28')).toBe('2026-09-28');
  });

  it('crosses a year boundary', () => {
    expect(normalizeWeekStart('2027-01-01')).toBe('2026-12-28');
  });

  it.each(['', '2026-9-28', '28-09-2026', '2026-02-30', '2026-13-01', 'garbage'])('rejects %j', (v) => {
    expect(normalizeWeekStart(v)).toBeNull();
  });
});

describe('weekEndOf', () => {
  it('returns the Sunday of the week, across month and year boundaries', () => {
    expect(weekEndOf('2026-10-12')).toBe('2026-10-18');
    expect(weekEndOf('2026-12-28')).toBe('2027-01-03');
  });
});
