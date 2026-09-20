import type { Ingredient } from '@/lib/types';
import type { IngredientInput } from '@/lib/schemas';
import { parseIngredientLines, cleanIngredientName } from './parse-ingredient';
import { findBestMatch } from './match-ingredient';

export interface AutoMatchResult {
  /** Clean ingredient name only — amount/unit live in their own fields, not duplicated here. */
  raw_text: string;
  amount: number | null;
  unit: string | null;
  ingredient: Ingredient | null;
  /** Set when no local match was found but an OFF candidate could be created on confirm. */
  offCandidate: IngredientInput | null;
  /** Neither local nor OFF found anything; this bare-name ingredient can still be created on confirm. */
  fallbackCandidate: IngredientInput | null;
}

export interface AutoMatchDeps {
  searchOff: (query: string) => Promise<IngredientInput[]>;
}

export async function autoMatchIngredients(
  rawLines: string[],
  localIngredients: Ingredient[],
  deps: AutoMatchDeps
): Promise<AutoMatchResult[]> {
  const results: AutoMatchResult[] = [];
  for (const raw of rawLines) {
    for (const { name, amount, unit } of parseIngredientLines(raw)) {
      const cleanName = cleanIngredientName(name) || name;

      const local = findBestMatch(cleanName, localIngredients);
      if (local) {
        results.push({ raw_text: cleanName, amount, unit, ingredient: local, offCandidate: null, fallbackCandidate: null });
        continue;
      }
      const offMatches = await deps.searchOff(cleanName).catch(() => []);
      const offCandidate = offMatches[0] ?? null;
      const fallbackCandidate: IngredientInput | null = offCandidate ? null : {
        name: cleanName, category: 'inne',
        kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null,
        default_unit: null, source: 'manual',
      };
      results.push({ raw_text: cleanName, amount, unit, ingredient: null, offCandidate, fallbackCandidate });
    }
  }
  return results;
}
