/**
 * Scores the LLM's ingredient structuring against tests/fixtures/ingredient-corpus.ts.
 * Each recipe's lines go to the real Ollama as a "## Składniki" page; every expected entry is looked
 * up in the output and checked for name (word-prefix match, so a base form counts), amount and unit.
 *
 * Needs: running Ollama with OLLAMA_MODEL (default gemma4:e2b).
 * Usage: pnpm eval:ingredients
 */
import { readFileSync } from 'node:fs';
import { extractRecipe } from '../src/lib/import/extract';
import { callOllama, OLLAMA_MODEL } from '../src/lib/import/ollama';
import { SYSTEM_PROMPT as DEFAULT_PROMPT, type ExtractedIngredient } from '../src/lib/import/schema';
import { matchEntry } from '../src/lib/import/eval-score';
import { CORPUS, type Expected } from '../tests/fixtures/ingredient-corpus';

// PROMPT_FILE=path.md evaluates a candidate prompt (text from the first "Jesteś" line on) instead of SYSTEM_PROMPT.
const SYSTEM_PROMPT = process.env.PROMPT_FILE
  ? readFileSync(process.env.PROMPT_FILE, 'utf8')
      .replace(/^[\s\S]*?(?=Jesteś)/, '')
      .trim()
  : DEFAULT_PROMPT;

const tally = { name: 0, amount: 0, unit: 0, total: 0 };

function score(want: Expected, pool: ExtractedIngredient[]): { line: string; rest: ExtractedIngredient[] } {
  tally.total++;
  const m = matchEntry(want, pool);
  if (!m.hit) return { line: `  ✗ ${want.name}: missing`, rest: m.rest };
  for (const k of ['name', 'amount', 'unit'] as const) if (m[k]) tally[k]++;
  const mark = m.amount && m.unit ? '✓' : '~';
  const detail = `${m.hit.amount ?? '-'} ${m.hit.unit ?? '-'} ${m.hit.name}`;
  return {
    line: `  ${mark} want ${want.amount ?? '-'} ${want.unit ?? '-'} ${want.name} | got ${detail}`,
    rest: m.rest,
  };
}

async function main() {
  console.log(`model: ${OLLAMA_MODEL}`);
  for (const [source, rows] of Object.entries(CORPUS)) {
    const md = `# ${source}\n\n## Składniki\n\n${rows.map(([raw]) => `- ${raw}`).join('\n')}\n\n## Przygotowanie\n\n1. Wymieszaj.`;
    console.log(`\n${source}`);
    try {
      const { recipeIngredient } = await extractRecipe(md, callOllama, SYSTEM_PROMPT);
      let pool = recipeIngredient;
      for (const [raw, expected] of rows) {
        console.log(` ${raw}`);
        if (expected.length === 0) console.log('  (expected nothing)');
        for (const want of expected) {
          const r = score(want, pool);
          pool = r.rest;
          console.log(r.line);
        }
      }
    } catch (e) {
      const n = rows.reduce((s, [, exp]) => s + exp.length, 0);
      tally.total += n;
      console.log(`  extraction failed (${n} entries lost): ${e}`);
    }
  }
  const pct = (n: number) => `${n}/${tally.total} (${Math.round((100 * n) / tally.total)}%)`;
  console.log(`\nname ${pct(tally.name)}  amount ${pct(tally.amount)}  unit ${pct(tally.unit)}`);
}

main();
