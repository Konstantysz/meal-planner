import { describe, it, expect } from 'vitest';
import {
  checkAppliedUnchanged,
  checkNames,
  checkNewMigrations,
  parseNameStatus,
} from '../../scripts/migration-order-check';

const base = ['0001_initial.sql', '0007_recipe_ingredient_optional.sql'];

describe('checkNames', () => {
  it('accepts NNNN_snake_case.sql with unique versions', () => {
    expect(checkNames([...base, '0008_new_thing.sql'])).toEqual([]);
  });

  it('flags a bad name and a duplicate version', () => {
    expect(checkNames(['8_x.sql', '0008_a.sql', '0008_b.sql'])).toEqual([
      '8_x.sql: name must be NNNN_snake_case.sql',
      '0008_b.sql: version 0008 already used by 0008_a.sql',
    ]);
  });
});

describe('checkNewMigrations', () => {
  const rb = (stem: string) => [`${stem}.down.sql`];
  const ck = (stem: string) => [`${stem}.verify.sql`];

  it('passes a new migration above the base maximum with rollback and check', () => {
    expect(checkNewMigrations([...base, '0008_new.sql'], base, rb('0008_new'), ck('0008_new'))).toEqual([]);
  });

  it('flags a new migration at or below the base maximum', () => {
    expect(checkNewMigrations([...base, '0006_late.sql'], base, rb('0006_late'), ck('0006_late'))).toEqual([
      '0006_late.sql: version must be above 0007, the highest on the base branch; renumber it',
    ]);
  });

  it('flags a missing or misnamed rollback and verification script', () => {
    expect(checkNewMigrations([...base, '0008_bar.sql'], base, [], ck('0008_foo'))).toEqual([
      '0008_bar.sql: missing supabase/rollbacks/0008_bar.down.sql',
      '0008_bar.sql: missing supabase/checks/0008_bar.verify.sql',
    ]);
  });

  it('accepts any version on an empty base branch', () => {
    expect(checkNewMigrations(['0001_initial.sql'], [], rb('0001_initial'), ck('0001_initial'))).toEqual([]);
  });

  it('leaves a renamed base migration to checkAppliedUnchanged instead of asking to renumber it', () => {
    const head = ['0001_initial.sql', '0007_renamed.sql'];
    expect(checkNewMigrations(head, base, [], [])).toEqual([]);
  });
});

describe('parseNameStatus', () => {
  it('reads status letters and base-side file names, renames included', () => {
    const out =
      'M\tsupabase/migrations/0005_a.sql\nR100\tsupabase/migrations/0003_old.sql\tsupabase/migrations/0003_new.sql\nA\tsupabase/migrations/0010_x.sql\n';
    expect(parseNameStatus(out)).toEqual([
      { status: 'M', path: '0005_a.sql' },
      { status: 'R', path: '0003_old.sql' },
      { status: 'A', path: '0010_x.sql' },
    ]);
  });
});

describe('checkAppliedUnchanged', () => {
  it('flags modified, deleted and renamed base migrations, not added ones', () => {
    const errors = checkAppliedUnchanged([
      { status: 'M', path: '0005_a.sql' },
      { status: 'D', path: '0006_b.sql' },
      { status: 'R', path: '0003_old.sql' },
      { status: 'A', path: '0010_x.sql' },
    ]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/^0005_a\.sql: modified, but it is already on the base branch/);
    expect(errors[1]).toMatch(/^0006_b\.sql: deleted/);
    expect(errors[2]).toMatch(/^0003_old\.sql: renamed/);
  });
});
