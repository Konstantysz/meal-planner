import { z } from 'zod';
import { RecipeJsonLdSchema } from '@/lib/schemas';
import { normalizeUnit } from './unit';

export const SYSTEM_PROMPT = `Jesteś ekstraktorem przepisów kulinarnych. Otrzymasz treść strony w Markdown. Zwróć WYŁĄCZNIE obiekt JSON zgodny z poniższym schematem, bez komentarzy i bez znaczników code fence:

{
  "name": string (wymagane, min 1 znak),
  "recipeIngredient": [{ "name": string, "amount": number | null, "unit": string | null, "optional": boolean }] (jeden wpis na składnik),
  "recipeInstructions": [{ "title": string | null, "text": string }] (jeden wpis na krok),
  "recipeYield": string | number | undefined (np. "4 porcje"),
  "prepTime": string | undefined (ISO 8601 duration, np. "PT20M")
}

Zasady dla składników:
- name: sama nazwa w mianowniku ("czosnek", nie "czosnku"), bez ilości, bez dopisków po myślniku i w nawiasach;
- amount i unit: gdy podano wagę w gramach, ona wygrywa ("1 duża cebula - około 160 g" → 160 g); zakres → górna granica; "pół" → 0.5; brak ilości → null;
- unit: g, ml, kg, l, łyżka, łyżeczka, szklanka, ząbek, szczypta, garść, sztuki; brak jednostki → null;
- wiersz z kilkoma składnikami daje kilka wpisów ("szczypta soli i pieprzu" → sól i pieprz);
- "lub": zostaw pierwszą opcję; wodę pomiń;
- optional: true dla "można pominąć", "do podania", "dodatki".

Zasady dla kroków:
- title: nagłówek kroku z oryginalnej strony ("Smażenie cebuli"); strona bez nagłówków kroków → null;
- text: szczegóły kroku, bez powtarzania tytułu; nie skracaj i nie łącz kroków;

Przykłady składników:
"2 łyżki oleju roślinnego do smażenia" → {"name":"olej roślinny","amount":2,"unit":"łyżka","optional":false}
"1 duża cebula - około 160 g" → {"name":"cebula","amount":160,"unit":"g","optional":false}
"4 łyżki ketchupu (można pominąć)" → {"name":"ketchup","amount":4,"unit":"łyżka","optional":true}
"szczypta soli i pieprzu" → {"name":"sól","amount":1,"unit":"szczypta","optional":false}, {"name":"pieprz","amount":1,"unit":"szczypta","optional":false}

Przykład kroku (aniagotuje):
"Smażenie cebuli. Na patelni rozgrzej olej i smaż pokrojoną cebulę przez 5 minut, aż się zeszkli." → {"title":"Smażenie cebuli","text":"Na patelni rozgrzej olej i smaż pokrojoną cebulę przez 5 minut, aż się zeszkli."}
Krok bez nagłówka: "Gotuj zupę 20 minut." → {"title":null,"text":"Gotuj zupę 20 minut."}

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
    recipeIngredient: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          optional: { type: 'boolean' },
        },
        required: ['name', 'amount', 'unit', 'optional'],
        additionalProperties: false,
      },
    },
    recipeInstructions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: ['string', 'null'] },
          text: { type: 'string' },
        },
        required: ['title', 'text'],
        additionalProperties: false,
      },
    },
    recipeYield: { type: 'string' },
    prepTime: { type: 'string' },
  },
  required: ['name', 'recipeIngredient', 'recipeInstructions'],
  additionalProperties: false,
} as const;

export const ExtractedIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  optional: z.boolean().default(false),
  // Not in LLM_OUTPUT_SCHEMA: set by applyQuantityRanges when the source line had a range ("1-2 łyżki").
  range: z.string().optional(),
});
export type ExtractedIngredient = z.infer<typeof ExtractedIngredientSchema>;

export const ExtractedStepSchema = z.object({
  title: z.string().nullable().default(null),
  text: z.string(),
});
export type ExtractedStep = z.infer<typeof ExtractedStepSchema>;

// Legacy shapes (a string, string[], [{text}] from page JSON-LD, or a model that ignores the new
// format) become {title: null, text}; a blank title becomes null.
function normalizeSteps(v: unknown): unknown {
  if (typeof v === 'string') return [{ title: null, text: v }];
  if (!Array.isArray(v)) return v;
  return v.map((s) => {
    if (typeof s === 'string') return { title: null, text: s };
    if (s && typeof s === 'object' && 'title' in s && typeof s.title === 'string' && !s.title.trim()) {
      return { ...s, title: null };
    }
    return s;
  });
}

// What the model returns: the JSON-LD recipe shape, but with structured ingredients and steps.
export const ExtractedRecipeSchema = RecipeJsonLdSchema.extend({
  recipeIngredient: z.array(ExtractedIngredientSchema).default([]),
  recipeInstructions: z.preprocess(normalizeSteps, z.array(ExtractedStepSchema)).default([]),
});
export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;

export function parseLlmJson(raw: string): ExtractedRecipe {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  // Small models emit `"image": null` instead of omitting the field; treat null as absent
  // (the ingredient schema defaults amount/unit back to null).
  const obj = JSON.parse(text, (_key, value) => (value === null ? undefined : value));
  const recipe = ExtractedRecipeSchema.parse(obj);
  return {
    ...recipe,
    recipeIngredient: recipe.recipeIngredient.map((i) => ({ ...i, unit: i.unit ? normalizeUnit(i.unit) : null })),
  };
}
