import type { ExtractedRecipe } from './schema';
import { normalizeUnit } from './unit';

// "1-2 łyżki", "1–2 łyżki", "1 do 2 łyżki", "0,5-1,5 szklanki". The word after the range is the unit candidate.
const RANGE = /(\d+(?:[.,]\d+)?)\s*(?:[-–—]|do)\s*(\d+(?:[.,]\d+)?)(?:\s+(\p{L}+))?/giu;
const TIME_WORD = /^(min|godz|sek|dni|dzie|h$)/i;
const BULLET = /^\s*[-*+•·]\s/;
const NUMBERED = /^\s*\d+[.)]\s/;

const num = (s: string) => Number(s.replace(',', '.'));
const stem = (w: string) => w.slice(0, Math.max(3, w.length - 2));
const nameWords = (name: string) =>
  name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

/** Words of an ingredient name must all appear (as a stem, to survive inflection) in the source line. */
function lineMentions(line: string, name: string): boolean {
  const lower = line.toLowerCase();
  const words = nameWords(name);
  return words.length > 0 && words.every((w) => lower.includes(stem(w)));
}

/** Words on the line beyond the ingredient name and units: fewer means a closer fit ("cukier" vs "cukier puder"). */
function extraWords(line: string, name: string): number {
  const stems = nameWords(name).map(stem);
  const tokens = line.toLowerCase().match(/\p{L}{3,}/gu) ?? [];
  return tokens.filter((t) => !normalizeUnit(t) && !stems.some((s) => t.startsWith(s))).length;
}

/** Ingredient-list lines only: the "Składniki" section when the page has one, else bullet lines. */
function ingredientLines(markdown: string): string[] {
  const all = markdown.split('\n');
  const start = all.findIndex((l) => /^\s*#{1,6}\s*składniki/i.test(l));
  let pool = all.filter((l) => BULLET.test(l));
  if (start >= 0) {
    const end = all.findIndex((l, i) => i > start && /^\s*#{1,6}\s/.test(l));
    pool = all.slice(start + 1, end < 0 ? undefined : end).filter((l) => BULLET.test(l) || NUMBERED.test(l));
  }
  return pool.filter((l) => /\d/.test(l));
}

/**
 * Small models drift on quantity ranges ("sok z cytryny 1-2 łyżki"): they keep the lower bound or
 * lose the range. The page text still has it, so this deterministic pass fixes the amount to the upper
 * bound and records the original range in `range` (shown in raw_text after auto-match). It only looks at
 * ingredient-list lines, only at the single best-fitting line for the ingredient (a tie is ambiguous and
 * skipped), and only acts when the model's amount equals one of the bounds and its unit agrees with the
 * unit next to the range, so time ranges ("5-7 minut") and unrelated lines are left alone.
 */
export function applyQuantityRanges(recipe: ExtractedRecipe, markdown: string): ExtractedRecipe {
  const lines = ingredientLines(markdown);
  const recipeIngredient = recipe.recipeIngredient.map((ing) => {
    if (ing.amount == null) return ing;
    const mentioning = lines.filter((l) => lineMentions(l, ing.name));
    if (mentioning.length === 0) return ing;
    const fit = Math.min(...mentioning.map((l) => extraWords(l, ing.name)));
    const best = mentioning.filter((l) => extraWords(l, ing.name) === fit);
    if (best.length !== 1) return ing;
    for (const m of best[0].matchAll(RANGE)) {
      const [whole, loS, hiS, word] = m;
      const lo = num(loS);
      const hi = num(hiS);
      if (!(hi > lo) || (ing.amount !== lo && ing.amount !== hi)) continue;
      const unit = word ? normalizeUnit(word) : null;
      if (!unit && word && TIME_WORD.test(word)) continue;
      if (unit ? unit !== ing.unit : ing.unit != null && ing.unit !== 'sztuki') continue;
      const range = unit ? whole : whole.slice(0, whole.length - (word ? word.length : 0)).trimEnd();
      return { ...ing, amount: hi, range };
    }
    return ing;
  });
  return { ...recipe, recipeIngredient };
}
