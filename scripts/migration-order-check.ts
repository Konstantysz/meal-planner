/**
 * Fails when supabase/migrations would deploy out of order, an applied migration changes, or a new
 * migration lacks its companions. Migrations deploy by version when they reach main and never re-run,
 * so a new version must be above every version on the base branch, a base migration must stay
 * byte-for-byte as it is, and each new migration ships a rollback and a verification script.
 *
 * Usage: pnpm tsx scripts/migration-order-check.ts [base-ref]   (default: origin/main)
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const NAME = /^(\d{4})_[a-z0-9_]+\.sql$/;

export function checkNames(files: string[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const f of files) {
    const m = NAME.exec(f);
    if (!m) {
      errors.push(`${f}: name must be NNNN_snake_case.sql`);
      continue;
    }
    const other = seen.get(m[1]!);
    if (other) errors.push(`${f}: version ${m[1]} already used by ${other}`);
    seen.set(m[1]!, f);
  }
  return errors;
}

export interface MigrationChange {
  status: string; // git diff --name-status letter: A, M, D, R…
  path: string; // file name in the base branch (the old name for a rename)
}

// Parses `git diff --name-status -M <merge-base> -- supabase/migrations`.
export function parseNameStatus(output: string): MigrationChange[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status = '', path = ''] = line.split('\t');
      return { status: status.charAt(0), path: path.split('/').pop() ?? path };
    });
}

export function checkAppliedUnchanged(changes: MigrationChange[]): string[] {
  const verb: Record<string, string> = { M: 'modified', D: 'deleted', R: 'renamed' };
  return changes
    .filter((c) => verb[c.status])
    .map(
      (c) =>
        `${c.path}: ${verb[c.status]}, but it is already on the base branch and production never re-runs it; ` +
        'revert the change and put new SQL in a new migration',
    );
}

export function checkNewMigrations(head: string[], base: string[], rollbacks: string[], checks: string[]): string[] {
  const version = (f: string) => f.slice(0, 4);
  const stem = (f: string) => f.replace(/\.sql$/, '');
  const baseVersions = new Set(base.map(version));
  const baseMax = [...baseVersions].sort().at(-1) ?? '0000';
  return head
    .filter((f) => !base.includes(f) && !baseVersions.has(version(f))) // same version = rename, reported above
    .flatMap((f) => {
      const errors: string[] = [];
      if (version(f) <= baseMax) {
        errors.push(`${f}: version must be above ${baseMax}, the highest on the base branch; renumber it`);
      }
      if (!rollbacks.includes(`${stem(f)}.down.sql`))
        errors.push(`${f}: missing supabase/rollbacks/${stem(f)}.down.sql`);
      if (!checks.includes(`${stem(f)}.verify.sql`)) errors.push(`${f}: missing supabase/checks/${stem(f)}.verify.sql`);
      return errors;
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const baseRef = process.argv[2] ?? 'origin/main';
  const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8' });
  const sql = (files: string[]) => files.filter((f) => f.endsWith('.sql'));
  const head = sql(readdirSync('supabase/migrations'));
  const base = sql(
    git(['ls-tree', '--name-only', `${baseRef}:supabase/migrations`])
      .split('\n')
      .filter(Boolean),
  );
  // Diff the merge base against the working tree, so the pre-commit hook sees uncommitted edits too.
  const mergeBase = git(['merge-base', baseRef, 'HEAD']).trim();
  const changes = parseNameStatus(git(['diff', '--name-status', '-M', mergeBase, '--', 'supabase/migrations']));
  const errors = [
    ...checkNames(head),
    ...checkAppliedUnchanged(changes),
    ...checkNewMigrations(head, base, readdirSync('supabase/rollbacks'), readdirSync('supabase/checks')),
  ];
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  const added = head.filter((f) => !base.includes(f)).length;
  console.log(`migration-order-check: ${added} new migration(s) vs ${baseRef}, all in order`);
}
