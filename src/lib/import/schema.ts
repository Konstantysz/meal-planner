import { RecipeJsonLdSchema, type RecipeJsonLd } from '@/lib/schemas';

export const SYSTEM_PROMPT = `Jesteś ekstraktorem przepisów kulinarnych. Otrzymasz treść strony w Markdown. Zwróć WYŁĄCZNIE obiekt JSON zgodny z poniższym schematem, bez komentarzy i bez znaczników code fence:

{
  "name": string (wymagane, min 1 znak),
  "recipeIngredient": string[] (lista składników, każdy jako pojedynczy string),
  "recipeInstructions": string[] (kroki jako lista stringów),
  "recipeYield": string | number | undefined (np. "4 porcje"),
  "prepTime": string | undefined (ISO 8601 duration, np. "PT20M"),
  "image": string | undefined (URL)
}

Jeśli pole jest nieobecne, pomiń je. Nie halucynuj.`;

export function parseLlmJson(raw: string): RecipeJsonLd {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const obj = JSON.parse(text);
  return RecipeJsonLdSchema.parse(obj);
}
