/**
 * Runs supabase/migrations on an in-process Postgres (PGlite) with a minimal Supabase auth stub.
 *
 * Incremental pass, per migration: run its verification script (baseline), apply the migration,
 * require "ALL PASS"; if a rollback exists, apply it and require the baseline outcome again, then
 * re-apply the migration and require "ALL PASS". Fresh pass: every migration on an empty database, then the seed.
 *
 * The stub is not Supabase: a human still runs each verification script on the live project.
 *
 * Usage: pnpm db:verify
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'supabase';

// Roles, auth.users, auth.uid() and the default privileges Supabase grants on public objects.
export const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export type VerifyOutcome = 'pass' | 'fail' | 'not-run';

// Verification scripts always end with: raise exception 'VERIFY NNNN: ALL PASS (n checks)' or 'FAIL ...'.
export function parseVerifyMessage(version: string, message: string): VerifyOutcome {
  const m = new RegExp(`VERIFY ${version}: (ALL PASS|FAIL)`).exec(message);
  if (!m) return 'not-run';
  return m[1] === 'ALL PASS' ? 'pass' : 'fail';
}

export interface MigrationFiles {
  version: string;
  migration: string;
  rollback?: string;
  check?: string;
}

// Companions match by stem, as db:order requires: 0008_x.sql pairs with 0008_x.down.sql and 0008_x.verify.sql.
export function collectMigrations(migrations: string[], rollbacks: string[], checks: string[]): MigrationFiles[] {
  return migrations
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => {
      const stem = f.replace(/\.sql$/, '');
      return {
        version: f.slice(0, 4),
        migration: f,
        rollback: rollbacks.find((r) => r === `${stem}.down.sql`),
        check: checks.find((c) => c === `${stem}.verify.sql`),
      };
    });
}

async function main(): Promise<number> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const read = (dir: string, file: string) => readFileSync(join(ROOT, dir, file), 'utf8');
  const list = (dir: string) => readdirSync(join(ROOT, dir));
  const all = collectMigrations(list('migrations'), list('rollbacks'), list('checks'));
  const seed = readFileSync(join(ROOT, 'seed.sql'), 'utf8');
  let failures = 0;

  const fresh = async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_STUB);
    return db;
  };
  type Db = Awaited<ReturnType<typeof fresh>>;

  const run = async (db: Db, label: string, sql: string): Promise<boolean> => {
    try {
      await db.exec(sql);
      return true;
    } catch (e) {
      console.error(`  ✗ ${label}: ${(e as Error).message}`);
      failures++;
      return false;
    }
  };
  const verify = async (db: Db, m: MigrationFiles): Promise<{ outcome: VerifyOutcome; message: string }> => {
    if (!m.check) return { outcome: 'not-run', message: '' };
    try {
      await db.exec(read('checks', m.check));
      return { outcome: 'not-run', message: 'verification script ended without raising' };
    } catch (e) {
      const message = (e as Error).message;
      return { outcome: parseVerifyMessage(m.version, message), message };
    }
  };
  const requirePass = async (db: Db, m: MigrationFiles, label: string) => {
    if (!m.check) return;
    const { outcome, message } = await verify(db, m);
    if (outcome === 'pass') {
      console.log(`  ✓ ${label}: ${message.split('\n')[0]}`);
    } else {
      console.error(`  ✗ ${label}:\n${message}`);
      failures++;
    }
  };

  console.log('Incremental pass (seed loaded after 0001)');
  const db = await fresh();
  for (const m of all) {
    console.log(`${m.migration}`);
    const baseline = await verify(db, m);
    if (m.check) console.log(`  · baseline: ${baseline.message.split('\n')[0] || baseline.outcome}`);
    if (!(await run(db, 'apply', read('migrations', m.migration)))) break;
    if (m.version === '0001' && !(await run(db, 'seed', seed))) break;
    await requirePass(db, m, 'after apply');
    if (m.rollback) {
      if (!(await run(db, 'rollback', read('rollbacks', m.rollback)))) break;
      // A rollback that runs but changes nothing would otherwise pass: it must restore the baseline outcome.
      if (m.check) {
        const back = await verify(db, m);
        if (back.outcome === baseline.outcome) {
          console.log(`  ✓ after rollback: ${back.message.split('\n')[0]} (baseline outcome restored)`);
        } else {
          console.error(
            `  ✗ after rollback: expected the baseline outcome (${baseline.outcome}), got:\n${back.message}`,
          );
          failures++;
        }
      }
      if (!(await run(db, 're-apply', read('migrations', m.migration)))) break;
      await requirePass(db, m, 'after rollback + re-apply');
    }
  }
  await db.close();

  console.log('Fresh pass (all migrations, then seed)');
  const db2 = await fresh();
  let ok = true;
  for (const m of all) ok = ok && (await run(db2, `apply ${m.migration}`, read('migrations', m.migration)));
  if (ok && (await run(db2, 'seed', seed))) console.log('  ✓ all migrations and the seed apply to an empty database');
  await db2.close();

  console.log(failures ? `db-verify: ${failures} failure(s)` : 'db-verify: all migrations verified');
  return failures ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // exitCode, not exit(): exiting while PGlite's handles close trips a libuv assertion on Windows.
  main().then((code) => {
    process.exitCode = code;
  });
}
