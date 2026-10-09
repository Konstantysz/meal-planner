/**
 * Lists wiki pages whose `sources:` paths changed since the page's `verified_commit`
 * (RULES §4). Whitespace-only changes are ignored. Informational: exits 0 unless `--strict`.
 *
 * Usage: pnpm wiki:stale [--strict]
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { WikiFile } from './wiki-check';

export interface ChangedFile {
  path: string;
  added: number;
  deleted: number;
}

export interface StalePage {
  page: string;
  commit: string;
  changed: ChangedFile[];
}

type DiffFn = (commit: string, paths: string[]) => ChangedFile[];

function frontmatter(content: string): { verified_commit?: string; sources?: { path?: string }[] } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  return m ? ((parseYaml(m[1]) as object) ?? {}) : {};
}

export function stalePages(files: WikiFile[], diff: DiffFn): StalePage[] {
  return files.flatMap((f) => {
    const { verified_commit: commit, sources } = frontmatter(f.content);
    const paths = (sources ?? []).flatMap((s) => (s.path ? [s.path] : []));
    if (!commit || paths.length === 0) return [];
    const changed = diff(commit, paths);
    return changed.length ? [{ page: f.path, commit, changed }] : [];
  });
}

/** `git diff -w --numstat`: files with only whitespace changes report 0/0 and are dropped. */
export function parseNumstat(out: string): ChangedFile[] {
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [a, d, path] = line.split('\t');
      return { path, added: a === '-' ? 1 : Number(a), deleted: d === '-' ? 1 : Number(d) };
    })
    .filter((c) => c.added + c.deleted > 0);
}

const gitDiff: DiffFn = (commit, paths) =>
  parseNumstat(execFileSync('git', ['diff', '-w', '--numstat', commit, 'HEAD', '--', ...paths], { encoding: 'utf8' }));

const SKIP_DIRS = new Set(['.obsidian', '_templates', '.trash']);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(join(dir, e.name));
    return e.name.endsWith('.md') ? [join(dir, e.name)] : [];
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = join(process.cwd(), 'docs', 'wiki');
  const files = walk(root).map((abs) => ({
    path: relative(root, abs).split(sep).join('/'),
    content: readFileSync(abs, 'utf8'),
  }));
  const stale = stalePages(files, gitDiff);
  for (const s of stale) {
    console.log(
      `${s.page} (verified ${s.commit}): ${s.changed.map((c) => `${c.path} +${c.added}/-${c.deleted}`).join(', ')}`,
    );
  }
  console.log(`wiki-stale: ${stale.length} page(s) with sources changed since verified_commit`);
  process.exit(stale.length && process.argv.includes('--strict') ? 1 : 0);
}
