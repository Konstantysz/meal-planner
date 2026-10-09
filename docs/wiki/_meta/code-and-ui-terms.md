---
title: "Code and UI Terms"
aliases: [glossary]
summary: "Code symbols, technical abbreviations and the Polish UI strings that appear in code and pages. Domain language lives in GLOSSARY.md."
tags: [meta, ui]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Shared types"
    path: src/lib/types.ts
  - title: "Initial schema"
    path: supabase/migrations/0001_initial.sql
---

# Code and UI Terms

> [!tldr]
> Code symbols and Polish UI strings. The domain language (Household, Plan, Slot, Macros, …) is defined in `GLOSSARY.md` at the repo root.

## Context

Pages link here on a term's first use. See [[meta]]. The domain language itself (canonical names and the words to avoid) lives in `GLOSSARY.md` at the repo root; this page adds code symbols and Polish UI strings.

## Code and technical terms

| Term | Meaning |
|---|---|
| `is_member_of(hid)` | A security-definer SQL function that RLS policies use to test membership. |
| RLS | Postgres Row Level Security. This app's authorization boundary. |
| `servings_base` | How many servings a recipe's ingredient amounts produce. |
| OFF | Open Food Facts, the public food database used for ingredient macro lookup. |
| `RecipeJsonLd` | The Zod-validated recipe shape. Its field names follow schema.org/Recipe (`recipeIngredient`, `recipeInstructions`, `recipeYield`). It is the contract for LLM extraction. |
| `LLM_MODE` | An env var. `server` sends extraction to Ollama; anything else means the in-browser WebLLM path. |
| WebLLM / WebGPU | In-browser LLM runtime (`@mlc-ai/web-llm`) and the GPU API it needs. |
| Ollama | Local LLM server used by the `LLM_MODE=server` path. |
| `incomplete` | A shopping-list line flag: at least one contributing ingredient has no macro data. |
| MOC | Map of Content, an index page that links a set of pages (see [[README]]). |
| `ponytail:` comment | A code comment marking a deliberate simplification and how to upgrade it. |

Deeper reading: [[household-model]], [[rls-authorization]], [[week-plan]], [[share-links]], [[offline-shopping-store]], [[llm-modes]], [[ingredient-auto-match]].

## Polish UI strings

| String | Where | Meaning |
|---|---|---|
| „przepis niedostępny" | Plan slot | Slot has a `recipe_id`, but the recipe could not be read. |
| „brak danych makro" | `MacroSummary` | No macro total available. |
| „(brak makro)" | Shopping item | The line's `incomplete` flag is set. |
| „puste" | Plan slot | Slot with no recipe. |
| „posiłek N" | Mobile plan, share page | Fallback slot label (position + 1). |
| śniadanie, lunch, obiad, przekąska, kolacja | Desktop plan rows | Fixed labels for positions 0–4. |
| „Tryb offline — …" | Shopping list | Shown while the shopping list's `offline` flag is set. The flag starts from `navigator.onLine` and follows the `online` and `offline` events. |
| „Import z URL" | `/recipes/new` | Opens the import dialog. |
| „Auto-mapuj składniki" | Import review | Runs auto-match. |
| Składniki / Kroki | Recipe views | Ingredients / Steps. |

## Related

- [[taxonomy]]
- [[RULES]]

## Sources

- `src/lib/types.ts`, `supabase/migrations/0001_initial.sql`, and the UI components under `src/components/`.

## Changelog

- 2026-10-09: Plan-slot string changed from „przepis usunięty" to „przepis niedostępny" (issue #16).
- 2026-10-09: Re-verified against a7f8f52 (all code terms and UI strings grepped in `src/`). `RecipeJsonLd` now cites only the field-name evidence for schema.org; offline banner condition made precise.
- 2026-10-09: Renamed from Glossary (alias kept); domain terms moved to the root `GLOSSARY.md`.
- 2026-10-04: Created.
