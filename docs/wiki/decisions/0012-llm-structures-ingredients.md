---
title: "0012 LLM Structures Ingredients"
summary: "The model returns each ingredient as {name, amount, unit, optional}; the regex line parser and the aniagotuje markup bypass are deleted."
tags: [import, llm, ingredients]
status: draft
owner: "@konstantysz"
created: 2026-10-11
updated: 2026-10-11
last_reviewed: 2026-10-11
review_interval_days: 180
confidence: medium
llm_generated: true
llm_model: "claude-sonnet-5-5"
human_reviewed: false
verified_commit: c9c43ec
sources:
  - title: "Output schema, prompt and parser"
    path: src/lib/import/schema.ts
  - title: "Unit normalisation"
    path: src/lib/import/unit.ts
  - title: "Auto-match orchestrator"
    path: src/lib/import/auto-match.ts
  - title: "Evaluation script"
    path: scripts/eval-ingredients.ts
  - title: "Evaluation corpus"
    path: tests/fixtures/ingredient-corpus.ts
  - title: "Ingredient auto-match"
    path: docs/wiki/concepts/ingredient-auto-match.md
---

# 0012 LLM Structures Ingredients

> [!tldr]
> The model splits each ingredient into name, amount, unit and optional flag. The Polish regex parser (`parse-ingredient.ts`, `split-ingredient.ts`, `ingredient-text.ts`) and the page-markup bypass (`extractIngredients`) are gone. Quality is measured with `pnpm eval:ingredients`, not pinned by a CI corpus.

## Context

The model was meant to be the universal extractor, so that no per-site code is needed. In practice it returned ingredients as plain strings and a growing chain of Polish regexes split them into name, amount and unit. Each new phrasing needed a new rule: 9 of 27 out-of-corpus lines came out wrong („5 dag sera" became 5 g, „200 g tofu, pokrojonego w kostkę" leaked a comment into the name). A bypass that read ingredient lines from aniagotuje's `.ingredient-qty` / `.ingredient-name` markup worked around the model instead of using it. See [[ingredient-auto-match]], [[import-pipeline]] and [[decisions]].

## Decision

**Status:** accepted (2026-10-11).

- `LLM_OUTPUT_SCHEMA` makes `recipeIngredient` an array of `{ name, amount, unit, optional }`, all required. `SYSTEM_PROMPT` carries the rules (base form of the name, a weight in grams wins, ranges take the upper bound, several ingredients per line give several entries, „lub" keeps the first option, water is skipped) and four examples.
- `parseLlmJson` validates with `ExtractedRecipeSchema` and runs `normalizeUnit` over `unit`, so „łyżek" becomes „łyżka".
- `autoMatchIngredients` takes the structured entries and goes straight to matching.
- The regex parser, its tests and the markup bypass are deleted. The corpus moved to `tests/fixtures/ingredient-corpus.ts` and scores the model through `pnpm eval:ingredients`.

## Alternatives considered

- Keep adding regex rules: each fix covers one phrasing and the next recipe breaks another.
- Keep the markup bypass: exact for aniagotuje, but per-site, and it hides how well the model does on every other page.
- Per-site selectors for more sources: the same bypass, one parser per site.

## Consequences

- Ingredient quality now depends on the model. gemma2:2b may drop „- około 160 g" or invent amounts; the next step is a stronger model (`gemma4:e2b`), not more regexes. See [[known-gaps]].
- Measured on the 115-entry corpus (2026-10-11): gemma2:2b gets name 97%, amount 70%, unit 57%; gemma4:e2b gets 97%, 87%, 89%.
- Structured output is longer, so a long recipe can hit the 1536-token limit (the „ucięta" error in the browser path).
- A regression in prompt or model is no longer caught by CI; run `pnpm eval:ingredients` against a local Ollama.
- The inflected-name gap („czosnku") closes: the prompt asks for the base form.

## Related

- [[decisions]]
- [[ingredient-auto-match]]
- [[llm-extraction]]
- [[import-pipeline]]
- [[html-cleaning]]
- [[0011-html-to-markdown-import]]

## Sources

- `src/lib/import/schema.ts`, `src/lib/import/unit.ts`, `src/lib/import/auto-match.ts`
- `scripts/eval-ingredients.ts`, `tests/fixtures/ingredient-corpus.ts`

## Changelog

- 2026-10-11: Created. Supersedes the staged parser and the markup bypass added on `feat/ingredient-parser-stages`.
