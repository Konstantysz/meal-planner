import type { Ingredient } from '@/lib/types';

// ponytail: word-overlap scoring, not true fuzzy matching (no edit distance) —
// good enough for short Polish food names, upgrade to a real fuzzy lib if mismatches pile up.
export function findBestMatch(name: string, ingredients: Ingredient[]): Ingredient | null {
  const query = normalize(name);
  if (!query) return null;

  let best: Ingredient | null = null;
  let bestScore = 0;

  for (const ing of ingredients) {
    const score = scoreMatch(query, normalize(ing.name));
    if (score > bestScore) {
      bestScore = score;
      best = ing;
    }
  }

  return bestScore >= 0.5 ? best : null;
}

function scoreMatch(query: string, candidate: string): number {
  if (query === candidate) return 1;
  if (candidate.includes(query) || query.includes(candidate)) return 0.8;

  const queryWords = query.split(' ').filter(Boolean);
  const candidateWords = candidate.split(' ').filter(Boolean);
  if (queryWords.length === 0 || candidateWords.length === 0) return 0;

  const overlap = candidateWords.filter((w) => queryWords.some((q) => wordsMatch(q, w))).length;
  return overlap / Math.max(queryWords.length, candidateWords.length);
}

// ponytail: common-prefix heuristic for Polish inflection (czosnku/czosnek), not a lemmatizer.
// Words under 4 letters need an exact match (sól != sos).
export function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 4 && i >= Math.min(a.length, b.length) - 3;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[.,]/g, '').replace(/\s+/g, ' ');
}
