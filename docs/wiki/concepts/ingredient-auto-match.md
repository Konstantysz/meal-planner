---
title: "Ingredient Auto-Match"
summary: "How the structured ingredients returned by the model are matched to the ingredient database, with Open Food Facts and placeholder fallbacks."
tags: [import, ingredients]
status: draft
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-11
last_reviewed: 2026-10-11
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-sonnet-5-5"
human_reviewed: false
verified_commit: c9c43ec
sources:
  - title: "Auto-match orchestrator"
    path: src/lib/import/auto-match.ts
  - title: "Structured ingredient schema and prompt"
    path: src/lib/import/schema.ts
  - title: "Unit normalisation"
    path: src/lib/import/unit.ts
  - title: "Name matcher"
    path: src/lib/import/match-ingredient.ts
  - title: "Review form"
    path: src/components/import/ImportReviewForm.tsx
  - title: "Auto-match tests"
    path: tests/unit/import/auto-match.test.ts
  - title: "Ingredient corpus"
    path: tests/fixtures/ingredient-corpus.ts
  - title: "Evaluation script"
    path: scripts/eval-ingredients.ts
  - title: "Leczo regression test"
    path: tests/unit/import/auto-match.leczo.test.ts
---

# Ingredient Auto-Match

> [!tldr]
> The model returns each ingredient as `{ name, amount, unit, optional }` ([[0012-llm-structures-ingredients]]). „Auto-mapuj składniki" matches each name by word overlap (with a prefix rule for Polish endings) against the local ingredients. If there's no local match **with macros**, it tries Open Food Facts. If that finds nothing either, it creates a placeholder ingredient. New rows are created when the user clicks the button, not when they save.

## Context

Before this existed (commit `e7cda69`), users had to re-pick every imported ingredient by hand. A chain of Polish regexes used to split ingredient strings into name, amount and unit; the model does that now. See [[concepts]], [[import-pipeline]], [[llm-extraction]] and [[ingredient-database]].

## How it works

`autoMatchIngredients(ingredients, localIngredients, { searchOff })`, for each `ExtractedIngredient`:

1. The name is used as returned (the prompt asks for the base form, without amounts or comments). `parseLlmJson` has already run `normalizeUnit` over the unit (`łyżek` → `łyżka`, `gramów` → `g`; `unit.ts`).
2. `findBestMatch(name, local)`: exact match scores 1, substring 0.8, otherwise word overlap / max word count, where two words match when equal or when `wordsMatch` finds a common prefix of at least 4 letters that is at least `min(len) - 3` („czosnku" ~ „czosnek", „pomidorów" ~ „pomidor"). Words under 4 letters need an exact match („sól" ≠ „sos"). Scores of 0.5 or more count as a match.
3. If the local match has any macro field, it's used. Otherwise `searchOff(name)[0]` becomes an `offCandidate`, which beats a macro-less local match. A failed `searchOff` call counts as no OFF result.
4. If there's neither, a `fallbackCandidate`: the name, category `inne`, null macros, `source: 'manual'`.

`ImportReviewForm.autoMatch` then `POST`s each OFF or fallback candidate to `/api/ingredients`, builds the `PickedIngredient[]` list (unit falls back to the ingredient's `default_unit`), and shows a summary notice. The review form lists each import line as `amount unit name`.

## Invariants and gotchas

- `raw_text` stored on the recipe is the **clean name only**. Amount and unit live in their own fields.
- A macro-less local match is kept only when OFF has nothing (commit `df8755a`). Before that fix, placeholders shadowed real data.
- What the model does with a line (one weight per entry, ranges, „lub", water, several ingredients on one line) is set by `SYSTEM_PROMPT`, not by code. A bad import is a prompt or model problem: add the line to the corpus and run `pnpm eval:ingredients`.
- A failed create (for example a name collision with `lower(name)`) silently drops that line. The notice then reports fewer matches.
- Matching is substring plus word overlap with a common-prefix rule, not a lemmatizer or edit distance. It covers endings („czosnku" ~ „czosnek") but not a short stem, like „mąki" vs. „mąka" (prefix 3, under the 4-letter minimum). Two `ponytail:` comments in `match-ingredient.ts` mark this.

## Measuring the model

`tests/fixtures/ingredient-corpus.ts` holds real aniagotuje ingredient lines with their expected entries, grouped by recipe. `pnpm eval:ingredients` (needs a local Ollama; `OLLAMA_MODEL` picks the model) sends each recipe's lines as a „Składniki" page and prints, per line, whether name, amount and unit came back right, plus totals. A name counts as a hit when its words match the expected ones with `wordsMatch`, so a base form passes. It is not a CI test: the result depends on the model.

Scores on the 115 expected entries (2026-10-11, `eval:ingredients`):

| Model | name | amount | unit |
|---|---|---|---|
| gemma2:2b (default) | 97% | 70% | 57% |
| gemma4:e2b | 97% | 87% | 89% |

Names are solid on both; amount and unit are where the 2B model falls short, so a stronger model is the next step, not more rules.

## Known gaps

- Ingredient rows are created when the user clicks „Auto-mapuj", so they stay in the shared table even if the user then cancels the import.
- Quality depends on the model: gemma2:2b can drop a „- około 160 g" weight or invent an amount ([[known-gaps]]).
- OFF results are often packaged products (brand names), and the first hit is taken without ranking.

## Related

- [[concepts]]
- [[import-pipeline]]
- [[llm-extraction]]
- [[ingredient-database]]
- [[recipe-yield-parsing]]
- [[0012-llm-structures-ingredients]]

## Sources

- `src/lib/import/{auto-match,match-ingredient,unit,schema}.ts`, `src/components/import/ImportReviewForm.tsx`, `scripts/eval-ingredients.ts`
- `tests/unit/import/auto-match*.test.ts`, `match-ingredient.test.ts`, `schema.test.ts`; `tests/fixtures/ingredient-corpus.ts`
- Commits `e7cda69` (auto-match) and `df8755a` (keep macro-less local matches)

## Changelog

- 2026-10-11: The model now structures ingredients; the staged regex parser, its corpus test and `cleanIngredientName` are removed ([[0012-llm-structures-ingredients]]).
- 2026-10-09: Re-verified against `a7f8f52`. Updated the failed-`searchOff` behaviour.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Created. Replaces the stale legacy claim that the review form doesn't auto-match.
