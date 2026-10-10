/**
 * Scores the LLM's ingredient structuring against tests/fixtures/ingredient-corpus.ts.
 * Each recipe's lines go to the real Ollama as a "## Składniki" page; every expected entry is looked
 * up in the output and checked for name (word-prefix match, so a base form counts), amount and unit.
 *
 * Needs: running Ollama with OLLAMA_MODEL (default gemma2:2b).
 * Usage: pnpm eval:ingredients
 */
import { extractRecipe } from '../src/lib/import/extract';
import { callOllama, OLLAMA_MODEL } from '../src/lib/import/ollama';
import { SYSTEM_PROMPT, type ExtractedIngredient } from '../src/lib/import/schema';
import { wordsMatch } from '../src/lib/import/match-ingredient';
import { CORPUS, type Expected } from '../tests/fixtures/ingredient-corpus';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const words = (s: string) => fold(s).split(/\s+/).filter(Boolean);
// Corpus names keep the page's inflection ("soli"), the model gives the base form ("sól"): fold diacritics
// and accept a shared 3-letter stem, which wordsMatch rejects for short words.
const stemMatch = (a: string, b: string) =>
  wordsMatch(a, b) || (a.length >= 3 && b.length >= 3 && a.slice(0, 3) === b.slice(0, 3));
// Every word of the expected name needs a matching word in the output name (or the reverse).
const nameHit = (want: string, got: string) =>
  words(want).every((w) => words(got).some((g) => stemMatch(w, g))) ||
  words(got).every((g) => words(want).some((w) => stemMatch(w, g)));
const amountHit = (want: number | null, got: number | null) =>
  want === null ? got === null : got !== null && Math.abs(got - want) < 0.01;

const tally = { name: 0, amount: 0, unit: 0, total: 0 };

function score(want: Expected, got: ExtractedIngredient[]): string {
  tally.total++;
  const hit = got.find((g) => nameHit(want.name, g.name));
  if (!hit) return `  ✗ ${want.name}: missing`;
  const flags = { name: true, amount: amountHit(want.amount, hit.amount), unit: want.unit === hit.unit };
  for (const k of ['name', 'amount', 'unit'] as const) if (flags[k]) tally[k]++;
  const mark = flags.amount && flags.unit ? '✓' : '~';
  const detail = `${hit.amount ?? '-'} ${hit.unit ?? '-'} ${hit.name}`;
  return `  ${mark} want ${want.amount ?? '-'} ${want.unit ?? '-'} ${want.name} | got ${detail}`;
}

async function main() {
  console.log(`model: ${OLLAMA_MODEL}`);
  for (const [source, rows] of Object.entries(CORPUS)) {
    const md = `# ${source}\n\n## Składniki\n\n${rows.map(([raw]) => `- ${raw}`).join('\n')}\n\n## Przygotowanie\n\n1. Wymieszaj.`;
    console.log(`\n${source}`);
    try {
      const { recipeIngredient } = await extractRecipe(md, callOllama, SYSTEM_PROMPT);
      for (const [raw, expected] of rows) {
        console.log(` ${raw}`);
        if (expected.length === 0) console.log('  (expected nothing)');
        for (const want of expected) console.log(score(want, recipeIngredient));
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
