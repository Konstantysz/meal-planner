---
title: "LLM Extraction"
summary: "Turning cleaned Markdown into a validated RecipeJsonLd: system prompt, JSON-Schema-constrained decoding, parseLlmJson, and retry-with-feedback."
tags: [llm, import]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Prompt, output schema, parser"
    path: src/lib/import/schema.ts
  - title: "Server extract route (calls extractRecipe)"
    path: src/app/api/import/extract/route.ts
  - title: "Retry orchestrator"
    path: src/lib/import/extract.ts
  - title: "RecipeJsonLd schema"
    path: src/lib/schemas.ts
  - title: "WebLLM engine"
    path: src/lib/import/engine.ts
  - title: "Ollama client"
    path: src/lib/import/ollama.ts
  - title: "Extract tests"
    path: tests/unit/import/extract.test.ts
---

# LLM Extraction

> [!tldr]
> A gemma-2-2b model gets the Polish `SYSTEM_PROMPT` and the Markdown, and decodes under a **JSON-Schema grammar** (`LLM_OUTPUT_SCHEMA`) at temperature 0.1. `parseLlmJson` strips code fences, treats `null` as absent and validates with `ExtractedRecipeSchema` (ingredients as `{name, amount, unit, optional}` objects, unit run through `normalizeUnit`). On the server, `extractRecipe` retries up to 2 times and feeds the validation error back into the prompt.

## Context

Small models produce broken JSON often enough that both the grammar and validation are needed. See [[concepts]], [[import-pipeline]] and [[llm-modes]].

## How it works

| Piece | Where | What |
|---|---|---|
| `SYSTEM_PROMPT` | `schema.ts` | Polish instructions: return **only** JSON with `name`, `recipeIngredient[]`, `recipeInstructions[]`, optional `recipeYield` and `prepTime`, and don't hallucinate. `recipeIngredient[]` holds `{name, amount, unit, optional}` objects, with rules and four examples ([[0012-llm-structures-ingredients]]) |
| `LLM_OUTPUT_SCHEMA` | `schema.ts` | JSON Schema: `name` (minLength 1), the two arrays required, `additionalProperties: false` |
| Grammar | `engine.ts` / `ollama.ts` | WebLLM: `response_format: { type: 'json_object', schema }`. Ollama: `format: LLM_OUTPUT_SCHEMA`. |
| Limits | both | `temperature 0.1`, max 1536 output tokens. Ollama `num_ctx 8192`. |
| `parseLlmJson(raw)` | `schema.ts` | Strips the code fence, runs `JSON.parse` with a reviver that drops `null`, then `ExtractedRecipeSchema.parse`, then `normalizeUnit` on each `unit` |
| `extractRecipe(md, llm, prompt, maxRetries=2)` | `extract.ts` | Up to 3 attempts. Each retry appends „UWAGA: poprzednia odpowiedź nie pasowała do schematu (…)". The final failure throws `LLM failed to produce valid recipe: …`. |

`LlmFn = (system, user) => Promise<string>` is the seam. `extractRecipe` doesn't know which runtime it's driving, so tests pass fake functions.

## Invariants and gotchas

- **The browser path doesn't retry.** `extractWithWebLlm` makes one call and parses it. Only the server route goes through `extractRecipe`.
- In the browser, `finish_reason === 'length'` throws a Polish error suggesting `LLM_MODE=server`. The server path doesn't check truncation; it relies on the retries.
- `LLM_OUTPUT_SCHEMA` is narrower than `ExtractedRecipeSchema` (which extends `RecipeJsonLdSchema`), which also accepts `{text}` steps, `image`, `cookTime` and `totalTime` from page JSON-LD. Change both together.
- Without the grammar, gemma2 sometimes looped on whitespace inside a string until it ran out of tokens. That's the reason for constrained decoding; see [[html-cleaning#Invariants and gotchas]] for the related quote fix.

## Known gaps

- Ingredient accuracy is measured by `pnpm eval:ingredients` (see [[ingredient-auto-match#Measuring the model]]), not in CI. `pnpm bench:llm` checks timing and success only.
- Structured ingredients make the output longer; a long recipe can hit the 1536-token limit (browser: „ucięta" error).

## Examples

```ts
const fake: LlmFn = async () => '{"name":"Zupa","recipeIngredient":[{"name":"cebula","amount":1,"unit":"sztuki","optional":false}],"recipeInstructions":["Gotuj."]}';
await extractRecipe('# Zupa …', fake, SYSTEM_PROMPT); // → ExtractedRecipe
```

## Related

- [[concepts]]
- [[llm-modes]]
- [[import-pipeline]]
- [[html-cleaning]]
- [[0005-json-schema-constrained-decoding]]
- [[run-llm-benchmark]]

## Sources

- `src/lib/import/schema.ts`, `extract.ts`, `engine.ts`, `ollama.ts`; `src/lib/schemas.ts`; `tests/unit/import/extract.test.ts`, `schema.test.ts`

## Changelog

- 2026-10-09: Re-verified against `a7f8f52`: no content change. Added the server extract route as a source.
- 2026-10-04: Created from legacy `import.md`. Added the "browser path doesn't retry" note.
