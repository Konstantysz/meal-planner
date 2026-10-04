import { RecipeJsonLdSchema, type RecipeJsonLd } from '@/lib/schemas';

export const SYSTEM_PROMPT = `Jesteś ekstraktorem przepisów kulinarnych. Otrzymasz treść strony w Markdown. Zwróć WYŁĄCZNIE obiekt JSON zgodny z poniższym schematem, bez komentarzy i bez znaczników code fence:

{
  "name": string (wymagane, min 1 znak),
  "recipeIngredient": string[] (lista składników, każdy jako pojedynczy string),
  "recipeInstructions": string[] (kroki jako lista stringów),
  "recipeYield": string | number | undefined (np. "4 porcje"),
  "prepTime": string | undefined (ISO 8601 duration, np. "PT20M")
}

Jeśli pole jest nieobecne, pomiń je. Nie halucynuj.`;

// Model input budget, shared by the browser (WebLLM) and server (Ollama) paths. Lives here, not in
// clean.ts, so the client bundle (engine.ts) doesn't pull in cheerio/turndown.
// Gemma-2-2b's in-browser context is 4096 tokens shared across system + user + output;
// ~4 chars/token is a safe rule of thumb for Polish/English mixed text.
export const MAX_MARKDOWN_CHARS = 6000;

// JSON Schema of the model's output (narrower than RecipeJsonLdSchema, which also covers page JSON-LD).
// Both runtimes compile it to a decoding grammar (Ollama `format`, WebLLM `response_format`), which
// forces valid structure and bounds whitespace — without it gemma2 can loop on whitespace until max tokens.
export const LLM_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    recipeIngredient: { type: 'array', items: { type: 'string' } },
    recipeInstructions: { type: 'array', items: { type: 'string' } },
    recipeYield: { type: 'string' },
    prepTime: { type: 'string' },
  },
  required: ['name', 'recipeIngredient', 'recipeInstructions'],
  additionalProperties: false,
} as const;

export function parseLlmJson(raw: string): RecipeJsonLd {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  // Small models emit `"image": null` instead of omitting the field; treat null as absent.
  const obj = JSON.parse(text, (_key, value) => (value === null ? undefined : value));
  return RecipeJsonLdSchema.parse(obj);
}
