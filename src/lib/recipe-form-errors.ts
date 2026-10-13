export type RecipeField = 'name' | 'servings_base' | 'prep_time_min' | 'source_author' | 'ingredients' | 'steps';
export type RecipeFieldErrors = Partial<Record<RecipeField | 'form', string>>;

const MESSAGES: Record<RecipeField, string> = {
  name: 'Podaj nazwę przepisu (do 200 znaków).',
  servings_base: 'Podaj liczbę porcji: liczbę całkowitą większą od zera.',
  prep_time_min: 'Czas przygotowania to liczba całkowita minut, od zera w górę.',
  source_author: 'Autor może mieć do 200 znaków.',
  ingredients: 'Dodaj co najmniej jeden składnik.',
  steps: 'Dodaj co najmniej jeden krok z treścią.',
};

const FIELDS = new Set<string>(Object.keys(MESSAGES));

/**
 * Turns Zod issues from `RecipeInputSchema` (client-side parse, or the `issues` of a 400 from
 * /api/recipes) into one Polish message per form field. Nested paths (`steps.0.title`) get a message
 * naming the row; an issue on any other field becomes a form-level message.
 */
export function recipeFieldErrors(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>): RecipeFieldErrors {
  const out: RecipeFieldErrors = {};
  for (const issue of issues) {
    const head = String(issue.path[0] ?? '');
    if (FIELDS.has(head)) {
      const field = head as RecipeField;
      out[field] ??= issue.path.length > 1 ? rowMessage(field, issue.path[1]) : MESSAGES[field];
    } else {
      out.form ??= 'Przepis zawiera nieprawidłowe dane.';
    }
  }
  return out;
}

function rowMessage(field: RecipeField, index: PropertyKey): string {
  const n = typeof index === 'number' ? ` ${index + 1}` : '';
  if (field === 'ingredients') return `Składnik${n}: popraw ilość, jednostkę lub nazwę.`;
  if (field === 'steps') return `Krok${n}: popraw tytuł (do 200 znaków) lub treść.`;
  return MESSAGES[field];
}
