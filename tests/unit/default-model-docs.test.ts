import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The default Ollama model is named in prose and comments in many places. A line that calls a model "default"
// must name the one in ollama.ts. Dated history (ADRs, the experiment report) is exempt.
const ROOT = process.cwd();
const EXEMPT = [join('docs', 'wiki', 'decisions'), join('docs', 'wiki', 'references', 'ollama-model-experiment.md')];
const SCANNED = [join('docs', 'wiki'), 'scripts', join('src', 'lib', 'import')];
const MODEL_TAG = /\bgemma\d?:[\w.]+/g;

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = join(dir, e.name);
    if (EXEMPT.includes(rel)) return [];
    return e.isDirectory() ? files(rel) : /\.(md|ts)$/.test(e.name) ? [rel] : [];
  });
}

describe('default Ollama model in docs and comments', () => {
  const declared = /OLLAMA_MODEL \?\? '([^']+)'/.exec(
    readFileSync(join(ROOT, 'src', 'lib', 'import', 'ollama.ts'), 'utf8'),
  )?.[1];

  it('is declared in ollama.ts', () => expect(declared).toBeDefined());

  it('is the only model called "default" anywhere else', () => {
    const stale = SCANNED.flatMap(files).flatMap((f) =>
      readFileSync(join(ROOT, f), 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          /\bdefault/i.test(line) && (line.match(MODEL_TAG) ?? []).some((m) => m !== declared)
            ? [`${f}:${i + 1}: ${line.trim()}`]
            : [],
        ),
    );
    expect(stale).toEqual([]);
  });
});
