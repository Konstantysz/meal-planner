/**
 * Reads the live verification record (the "Verification" table in docs/wiki/references/migration-history.md)
 * so CI can hold a migration PR until its live baseline is recorded, and catch check counts that drift
 * from what the verification script really runs.
 */

export const RECORD_PATH = 'docs/wiki/references/migration-history.md';

const HEADER = ['Migration', 'Before merge', 'After deploy'];

export interface VerificationRow {
  before: string; // "Before merge" cell: the live baseline
  after: string; // "After deploy" cell
}

// Rows of the table under "## Verification": | `0010` | `FAIL 10 (12 checks)` (2026-10-13) | pending |
export function parseVerificationTable(markdown: string): Map<string, VerificationRow> {
  const section = markdown.split(/^## Verification\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  const rows = new Map<string, VerificationRow>();
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
    if (cells[0] === 'Migration' && cells.join('|') !== HEADER.join('|')) {
      throw new Error(`${RECORD_PATH}: the Verification table header must be | ${HEADER.join(' | ')} |`);
    }
    const version = /^`(\d{4})`$/.exec(cells[0] ?? '')?.[1];
    if (!version) continue;
    if (cells.length !== 3) throw new Error(`${RECORD_PATH}: Verification row ${version} must have exactly 3 cells`);
    rows.set(version, { before: cells[1]!, after: cells[2]! });
  }
  return rows;
}

// A live baseline cell starts with the verify script's result before the migration: `FAIL 10 (12 checks)`.
// ALL PASS before the merge would mean production already has the change, so it does not count.
const BASELINE = /^`FAIL \d+ \(\d+ checks\)`/;

export function checkBaselinesRecorded(newMigrations: string[], rows: Map<string, VerificationRow>): string[] {
  return newMigrations.flatMap((f) => {
    const version = f.slice(0, 4);
    const stem = f.replace(/\.sql$/, '');
    if (BASELINE.test(rows.get(version)?.before ?? '')) return [];
    return [
      `${f}: no live baseline in ${RECORD_PATH} (Verification table, "Before merge"). ` +
        `Run supabase/checks/${stem}.verify.sql in the SQL editor and start the cell with its result, e.g. \`FAIL 10 (12 checks)\`.`,
    ];
  });
}

// Every "(n checks)" in a version's row must match the count the verification script reports.
export function checkRecordedCounts(rows: Map<string, VerificationRow>, counts: Map<string, number>): string[] {
  const errors: string[] = [];
  for (const [version, row] of rows) {
    const actual = counts.get(version);
    if (actual === undefined) continue;
    for (const m of `${row.before} ${row.after}`.matchAll(/\((\d+) checks\)/g)) {
      if (Number(m[1]) !== actual) {
        errors.push(`${RECORD_PATH}: ${version} records ${m[1]} checks, but its verification script runs ${actual}`);
        break;
      }
    }
  }
  return errors;
}

// "VERIFY 0010: FAIL 10 (12 checks)" -> 12
export function checkCount(headline: string): number | undefined {
  const m = /\((\d+) checks\)/.exec(headline);
  return m ? Number(m[1]) : undefined;
}
