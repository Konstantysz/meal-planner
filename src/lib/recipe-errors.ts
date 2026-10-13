import type { ZodError } from 'zod';

/** Field name (as the recipe form knows it) to a Polish message. */
export type RecipeFieldErrors = Record<string, string>;

const MESSAGES: Record<string, string> = {
  name: 'Podaj nazwę przepisu (do 200 znaków)',
  servings_base: 'Liczba porcji musi być całkowita i większa od zera',
  prep_time_min: 'Czas przygotowania musi być liczbą całkowitą, zero lub więcej',
  source_author: 'Autor może mieć do 200 znaków',
  source_url: 'Adres źródła jest nieprawidłowy',
  ingredients: 'Dodaj co najmniej jeden składnik',
  steps: 'Dodaj co najmniej jeden krok',
  diet_tags: 'Nieznana dieta',
  allergens: 'Nieznany alergen',
};

/** A problem inside list item N (1-based), as opposed to the list being too short. */
const ITEM_MESSAGES: Record<string, (n: number) => string> = {
  ingredients: (n) => `Popraw składnik nr ${n}`,
  steps: (n) => `Popraw krok nr ${n}`,
};

/**
 * Turns a Zod error for `RecipeInputSchema` into one Polish message per form field, so the form shows
 * "Dodaj co najmniej jeden krok" next to the steps instead of raw issue JSON. A problem inside an item
 * (e.g. `steps.0.text`) is reported on the list field as "Popraw krok nr 1". Unknown fields fall under `_form`.
 */
export function recipeFieldErrors(error: ZodError): RecipeFieldErrors {
  const out: RecipeFieldErrors = {};
  for (const issue of error.issues) {
    const root = String(issue.path[0] ?? '_form');
    const n = typeof issue.path[1] === 'number' ? issue.path[1] + 1 : null;
    const message = issue.path.length > 1 && n ? ITEM_MESSAGES[root]?.(n) : MESSAGES[root];
    const key = MESSAGES[root] ? root : '_form';
    out[key] ??= message ?? 'Nieprawidłowe dane przepisu';
  }
  return out;
}
