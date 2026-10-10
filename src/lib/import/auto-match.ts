import type { Ingredient } from '@/lib/types';
import type { IngredientInput } from '@/lib/schemas';
import type { ExtractedIngredient } from './schema';
import { findBestMatch } from './match-ingredient';

export interface AutoMatchResult {
  /** Clean ingredient name only — amount/unit live in their own fields, not duplicated here. */
  raw_text: string;
  amount: number | null;
  unit: string | null;
  optional?: boolean;
  ingredient: Ingredient | null;
  /** Set when no local match with macros was found but an OFF candidate could be created on confirm. */
  offCandidate: IngredientInput | null;
  /** Neither local nor OFF found anything; this bare-name ingredient can still be created on confirm. */
  fallbackCandidate: IngredientInput | null;
}

export interface AutoMatchDeps {
  searchOff: (query: string) => Promise<IngredientInput[]>;
}

export async function autoMatchIngredients(
  ingredients: ExtractedIngredient[],
  localIngredients: Ingredient[],
  deps: AutoMatchDeps,
): Promise<AutoMatchResult[]> {
  const results: AutoMatchResult[] = [];
  for (const { name, amount, unit, optional } of ingredients) {
    const cleanName = name.trim();
    const local = findBestMatch(cleanName, localIngredients);
    const hasMacros =
      !!local &&
      [local.kcal_per_100g, local.protein_per_100g, local.fat_per_100g, local.carbs_per_100g].some((v) => v != null);
    const offCandidate = hasMacros ? null : ((await deps.searchOff(cleanName).catch(() => []))[0] ?? null);
    // A macro-less local match is kept only when OFF has nothing better.
    const ingredient = offCandidate ? null : local;
    const fallbackCandidate: IngredientInput | null =
      ingredient || offCandidate
        ? null
        : {
            name: cleanName,
            category: 'inne',
            kcal_per_100g: null,
            protein_per_100g: null,
            fat_per_100g: null,
            carbs_per_100g: null,
            default_unit: null,
            source: 'manual',
          };
    results.push({ raw_text: cleanName, amount, unit, optional, ingredient, offCandidate, fallbackCandidate });
  }
  return results;
}
