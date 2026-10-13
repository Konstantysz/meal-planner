export type MatchStatus = 'matched' | 'created' | 'unmatched';

/** What auto-match did with one imported row. */
export interface MatchOutcomeRow {
  /** The imported text of the row. */
  text: string;
  status: MatchStatus;
  /** Database ingredient the row was mapped to; null when unmatched. */
  ingredientName: string | null;
}

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  matched: 'dopasowany',
  created: 'nowy',
  unmatched: 'bez dopasowania',
};

/** Row counts per status, for the one-line summary above the per-row list. */
export function summarizeOutcome(rows: MatchOutcomeRow[]): Record<MatchStatus, number> {
  const counts: Record<MatchStatus, number> = { matched: 0, created: 0, unmatched: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}
