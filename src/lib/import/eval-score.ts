// Scoring for scripts/eval-ingredients.ts: pairs each expected ingredient with one model output entry.
import { wordsMatch } from './match-ingredient';
import type { ExtractedIngredient, ExtractedStep } from './schema';

export interface ExpectedEntry {
  name: string;
  amount: number | null;
  unit: string | null;
}

export interface EntryMatch {
  hit?: ExtractedIngredient;
  name: boolean;
  amount: boolean;
  unit: boolean;
  /** The pool without `hit`, so the next expected entry cannot reuse it. */
  rest: ExtractedIngredient[];
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const words = (s: string) => fold(s).split(/\s+/).filter(Boolean);

// Corpus names keep the page's inflection ("soli"), the model gives the base form ("sól"): fold diacritics
// and accept a shared 3-letter stem, which wordsMatch rejects for short words.
const stemMatch = (a: string, b: string) =>
  wordsMatch(a, b) || (a.length >= 3 && b.length >= 3 && a.slice(0, 3) === b.slice(0, 3));

/** Every word of one name needs a matching word in the other, in either direction. */
export const nameHit = (want: string, got: string): boolean =>
  words(want).every((w) => words(got).some((g) => stemMatch(w, g))) ||
  words(got).every((g) => words(want).some((w) => stemMatch(w, g)));

const amountHit = (want: number | null, got: number | null) =>
  want === null ? got === null : got !== null && Math.abs(got - want) < 0.01;

// Ranks candidates that pass nameHit: a real word match (pieprzu/pieprz) beats a bare 3-letter stem (pieprzu/pierś).
const closeness = (want: string, got: string) =>
  words(want).reduce((s, w) => s + (words(got).some((g) => wordsMatch(w, g)) ? 2 : 0), 0);

/** Takes the closest unused output entry, so one output can't score two expected lines (cebula 160 g / 200 g). */
export function matchEntry(want: ExpectedEntry, pool: readonly ExtractedIngredient[]): EntryMatch {
  const hit = pool
    .filter((g) => nameHit(want.name, g.name))
    .reduce<ExtractedIngredient | undefined>(
      (best, g) => (!best || closeness(want.name, g.name) > closeness(want.name, best.name) ? g : best),
      undefined,
    );
  if (!hit) return { name: false, amount: false, unit: false, rest: [...pool] };
  return {
    hit,
    name: true,
    amount: amountHit(want.amount, hit.amount),
    unit: want.unit === hit.unit,
    rest: pool.filter((g) => g !== hit),
  };
}

export interface StepScore {
  count: number;
  titled: number;
  /** Titled steps whose text still starts with the title: the model repeated it instead of splitting. */
  repeated: number;
}

/** Step count and title presence of the model's steps (scripts/eval-ingredients.ts, aniagotuje fixture). */
export function scoreSteps(steps: readonly ExtractedStep[]): StepScore {
  const titled = steps.filter((s) => s.title);
  return {
    count: steps.length,
    titled: titled.length,
    repeated: titled.filter((s) => s.text.toLowerCase().startsWith(s.title!.toLowerCase())).length,
  };
}
