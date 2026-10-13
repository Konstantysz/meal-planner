import { describe, it, expect } from 'vitest';
import { collectMigrations, parseVerifyMessage, verifyHeadline } from '../../scripts/db-verify';

describe('parseVerifyMessage', () => {
  it('reads ALL PASS and FAIL for the matching version only', () => {
    expect(parseVerifyMessage('0010', 'VERIFY 0010: ALL PASS (12 checks)\nPASS 1 x')).toBe('pass');
    expect(parseVerifyMessage('0010', 'VERIFY 0010: FAIL 2 (12 checks)')).toBe('fail');
    expect(parseVerifyMessage('0010', 'VERIFY 0009: ALL PASS (3 checks)')).toBe('not-run');
    expect(parseVerifyMessage('0010', 'relation "app_admins" does not exist')).toBe('not-run');
  });
});

describe('verifyHeadline', () => {
  it('keeps the first line, so a partial rollback (FAIL 3 vs FAIL 8) differs from the baseline', () => {
    expect(verifyHeadline('VERIFY 0008: FAIL 8 (12 checks)\nFAIL 1 x\nPASS 2 y')).toBe(
      'VERIFY 0008: FAIL 8 (12 checks)',
    );
    expect(verifyHeadline('VERIFY 0008: FAIL 3 (12 checks)\nFAIL 1 x')).not.toBe(
      verifyHeadline('VERIFY 0008: FAIL 8 (12 checks)\nFAIL 1 x'),
    );
    expect(verifyHeadline('')).toBe('');
  });
});

describe('collectMigrations', () => {
  it('pairs migrations with their rollback and check by version, in order', () => {
    expect(
      collectMigrations(['0004_b.sql', '0001_a.sql', 'README.md'], ['0004_b.down.sql'], ['0004_b.verify.sql']),
    ).toEqual([
      { version: '0001', migration: '0001_a.sql', rollback: undefined, check: undefined },
      { version: '0004', migration: '0004_b.sql', rollback: '0004_b.down.sql', check: '0004_b.verify.sql' },
    ]);
  });

  it('ignores companions whose stem differs from the migration', () => {
    expect(collectMigrations(['0008_bar.sql'], ['0008_foo.down.sql'], ['0008_foo.verify.sql', '.gitkeep'])).toEqual([
      { version: '0008', migration: '0008_bar.sql', rollback: undefined, check: undefined },
    ]);
  });
});
