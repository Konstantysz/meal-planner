/**
 * Fails when an exported function in src/lib/** is neither referenced in tests/** nor named in the
 * "Not covered" section of docs/wiki/references/test-coverage.md.
 *
 * Usage: pnpm tsx scripts/test-coverage-check.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// ponytail: regex over exports, not an AST. Misses `export { x }` lists and re-exports; add if they appear.
const EXPORT_FN =
  /^export\s+(?:async\s+)?function\s+(\w+)|^export\s+const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>/gm;

export function exportedFunctions(source: string): string[] {
  return [...source.matchAll(EXPORT_FN)].map((m) => (m[1] ?? m[2]) as string);
}

export function notCoveredSection(doc: string): string {
  const m = /^## Not covered\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(doc);
  return m?.[1] ?? '';
}

export interface Uncovered {
  file: string;
  name: string;
}

export function findUncovered(
  libFiles: { path: string; content: string }[],
  testsText: string,
  notCovered: string,
): Uncovered[] {
  const used = (name: string, text: string) => new RegExp(`\\b${name}\\b`).test(text);
  return libFiles.flatMap((f) =>
    exportedFunctions(f.content)
      .filter((name) => !used(name, testsText) && !used(name, notCovered))
      .map((name) => ({ file: f.path, name })),
  );
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const read = (abs: string) => readFileSync(abs, 'utf8');
  const lib = walk('src/lib')
    .filter((p) => /\.tsx?$/.test(p))
    .map((abs) => ({ path: relative('.', abs).split(sep).join('/'), content: read(abs) }));
  const testsText = walk('tests').map(read).join('\n');
  const doc = read('docs/wiki/references/test-coverage.md');
  const missing = findUncovered(lib, testsText, notCoveredSection(doc));
  for (const m of missing) console.error(`${m.file}: ${m.name} has no test reference`);
  if (missing.length) {
    console.error('Add a test, or list it under "Not covered" in docs/wiki/references/test-coverage.md.');
    process.exit(1);
  }
  console.log('test-coverage-check: all exported src/lib functions are tested or listed');
}
