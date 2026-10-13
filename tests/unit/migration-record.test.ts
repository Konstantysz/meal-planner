import { describe, it, expect } from 'vitest';
import {
  checkBaselinesRecorded,
  checkCount,
  checkRecordedCounts,
  parseVerificationTable,
} from '../../scripts/migration-record';

const page = `# Migration History

| Version | PR |
|---|---|
| \`0009\` | #42 |

## Verification

| Migration | Before merge | After deploy |
|---|---|---|
| \`0008\` | not run (merged without a baseline) | \`ALL PASS (5 checks)\` (2026-10-13) |
| \`0009\` | not yet run | pending |
| \`0010\` | \`FAIL 10 (12 checks)\` (2026-10-13) | pending |

## Open findings

| \`0011\` | \`FAIL 1 (1 checks)\` | x |
`;

describe('parseVerificationTable', () => {
  it('reads only the rows under ## Verification', () => {
    const rows = parseVerificationTable(page);
    expect([...rows.keys()]).toEqual(['0008', '0009', '0010']);
    expect(rows.get('0010')).toEqual({ before: '`FAIL 10 (12 checks)` (2026-10-13)', after: 'pending' });
  });

  it('rejects a row with an extra cell and a changed header', () => {
    expect(() => parseVerificationTable('## Verification\n\n| `0010` | a | b | c |\n')).toThrow(/exactly 3 cells/);
    expect(() =>
      parseVerificationTable('## Verification\n\n| Migration | Before merge | After deploy | Notes |\n'),
    ).toThrow(/header must be/);
  });

  it('returns no rows when the section is missing', () => {
    expect(parseVerificationTable('# Nothing here').size).toBe(0);
  });
});

describe('checkBaselinesRecorded', () => {
  const rows = parseVerificationTable(page);

  it('passes a new migration whose live baseline is recorded', () => {
    expect(checkBaselinesRecorded(['0010_ingredient_ownership.sql'], rows)).toEqual([]);
  });

  it('flags a new migration with no row or no result in "Before merge"', () => {
    const errors = checkBaselinesRecorded(['0009_update_recipe_rpc.sql', '0012_new.sql'], rows);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('0009_update_recipe_rpc.sql: no live baseline');
    expect(errors[0]).toContain('supabase/checks/0009_update_recipe_rpc.verify.sql');
    expect(errors[1]).toContain('0012_new.sql: no live baseline');
  });

  it('rejects ALL PASS before the merge and an expected result that was not run', () => {
    const md = (cell: string) => `## Verification\n\n| \`0011\` | ${cell} | pending |\n`;
    expect(checkBaselinesRecorded(['0011_x.sql'], parseVerificationTable(md('`ALL PASS (3 checks)`')))).toHaveLength(1);
    expect(
      checkBaselinesRecorded(['0011_x.sql'], parseVerificationTable(md('not yet run (expect `FAIL 3 (3 checks)`)'))),
    ).toHaveLength(1);
    expect(checkBaselinesRecorded(['0011_x.sql'], parseVerificationTable(md('`FAIL 3 (3 checks)` (live)')))).toEqual(
      [],
    );
  });
});

describe('checkRecordedCounts', () => {
  const rows = parseVerificationTable(page);

  it('passes when every recorded count matches the script', () => {
    expect(
      checkRecordedCounts(
        rows,
        new Map([
          ['0008', 5],
          ['0010', 12],
        ]),
      ),
    ).toEqual([]);
  });

  it('flags a recorded count that differs from the script, once per version', () => {
    expect(checkRecordedCounts(rows, new Map([['0008', 6]]))).toEqual([
      'docs/wiki/references/migration-history.md: 0008 records 5 checks, but its verification script runs 6',
    ]);
  });

  it('skips versions the run did not count', () => {
    expect(checkRecordedCounts(rows, new Map())).toEqual([]);
  });
});

describe('checkCount', () => {
  it('reads the count from a verify headline', () => {
    expect(checkCount('VERIFY 0010: FAIL 10 (12 checks)')).toBe(12);
    expect(checkCount('verification script ended without raising')).toBeUndefined();
  });
});
