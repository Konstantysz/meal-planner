import type { ExtractedRecipe } from './schema';
import { normalizeUnit } from './unit';

// "1-2 łyżki", "1–2 łyżki", "1 do 2 łyżki", "0,5-1,5 szklanki". The word after the range is the unit candidate.
const RANGE = /(\d+(?:[.,]\d+)?)\s*(?:[-–—]|do)\s*(\d+(?:[.,]\d+)?)(?:\s+(\p{L}+))?/giu;
const TIME_WORD = /^(min|godz|sek|dni|dzie|h$)/i;

const num = (s: string) => Number(s.replace(',', '.'));

/** Words of an ingredient name must all appear (as a stem, to survive inflection) in the source line. */
function lineMentions(line: string, name: string): boolean {
  const lower = line.toLowerCase();
  const words = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return words.length > 0 && words.every((w) => lower.includes(w.slice(0, Math.max(3, w.length - 2))));
}

/**
 * Small models drift on quantity ranges ("sok z cytryny 1-2 łyżki"): they keep the lower bound or
 * lose the range. The page text still has it, so this deterministic pass fixes the amount to the upper
 * bound and records the original range in `range` (shown in raw_text after auto-match). It only acts
 * when the model's amount equals one of the bounds and its unit agrees with the unit next to the range,
 * so time ranges ("5-7 minut") and unrelated lines are left alone.
 */
export function applyQuantityRanges(recipe: ExtractedRecipe, markdown: string): ExtractedRecipe {
  const lines = markdown.split('\n').filter((l) => /\d/.test(l));
  const recipeIngredient = recipe.recipeIngredient.map((ing) => {
    if (ing.amount == null) return ing;
    for (const line of lines) {
      if (!lineMentions(line, ing.name)) continue;
      for (const m of line.matchAll(RANGE)) {
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
    }
    return ing;
  });
  return { ...recipe, recipeIngredient };
}
