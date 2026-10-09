---
title: "Glossary"
summary: "Domain terms, abbreviations and the Polish UI strings that appear in code and pages."
tags: [meta, ui]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "Shared types"
    path: src/lib/types.ts
  - title: "Initial schema"
    path: supabase/migrations/0001_initial.sql
---

# Glossary

> [!tldr]
> Terms used across the code and the wiki. The UI is in Polish and the code in English. This page maps between the two.

## Context

Pages link here on a term's first use. See [[meta]].

## Domain terms

| Term | Meaning |
|---|---|
| Household | The unit that owns recipes and plans (`households` table). Users reach data through membership. UI: „gospodarstwo". |
| Member / owner | A row in `household_members`, with role `owner` or `member`. |
| `is_member_of(hid)` | A security-definer SQL function that RLS policies use to test membership. |
| RLS | Postgres Row Level Security. This app's authorization boundary. |
| Plan | One household's week, keyed by `week_start_date` (a Monday in the plan UI). |
| Slot | One meal in a plan: `(plan_id, date, position)`, with an optional recipe and servings. |
| `servings_base` | How many servings a recipe's ingredient amounts produce. |
| Macros | kcal, protein, fat, carbs. UI abbreviations: **B** (białko, protein), **T** (tłuszcz, fat), **W** (węglowodany, carbs). |
| OFF | Open Food Facts, the public food database used for ingredient macro lookup. |
| Have-map | Per-device, per-week map of „mam to" (have it) checkboxes on the shopping list, kept in IndexedDB. |
| Pantry | The planned server-side `pantry_items` table. It exists in the schema but nothing uses it. |
| Share token | A 32-character URL-safe random string in `share_tokens` that grants anonymous read access to one plan. |
| `RecipeJsonLd` | The Zod-validated recipe shape modelled on schema.org/Recipe. It is the contract for LLM extraction. |
| `LLM_MODE` | An env var. `server` sends extraction to Ollama; anything else means the in-browser WebLLM path. |
| WebLLM / WebGPU | In-browser LLM runtime (`@mlc-ai/web-llm`) and the GPU API it needs. |
| Ollama | Local LLM server used by the `LLM_MODE=server` path. |
| Auto-match | Mapping imported ingredient lines onto ingredient rows (local DB first, then OFF, then a bare placeholder). |
| `incomplete` | A shopping-list line flag: at least one contributing ingredient has no macro data. |
| MOC | Map of Content, an index page that links a set of pages (see [[README]]). |
| `ponytail:` comment | A code comment marking a deliberate simplification and how to upgrade it. |

Deeper reading: [[household-model]], [[rls-authorization]], [[week-plan]], [[share-links]], [[offline-shopping-store]], [[llm-modes]], [[ingredient-auto-match]].

## Polish UI strings

| String | Where | Meaning |
|---|---|---|
| „przepis usunięty" | Plan slot | Slot has a `recipe_id`, but the recipe could not be read. |
| „brak danych makro" | `MacroSummary` | No macro total available. |
| „(brak makro)" | Shopping item | The line's `incomplete` flag is set. |
| „puste" | Plan slot | Slot with no recipe. |
| „posiłek N" | Mobile plan, share page | Fallback slot label (position + 1). |
| śniadanie, lunch, obiad, przekąska, kolacja | Desktop plan rows | Fixed labels for positions 0–4. |
| „Tryb offline — …" | Shopping list | Shown while `navigator.onLine` is false. |
| „Import z URL" | `/recipes/new` | Opens the import dialog. |
| „Auto-mapuj składniki" | Import review | Runs auto-match. |
| Składniki / Kroki | Recipe views | Ingredients / Steps. |

## Related

- [[taxonomy]]
- [[RULES]]

## Sources

- `src/lib/types.ts`, `supabase/migrations/0001_initial.sql`, and the UI components under `src/components/`.

## Changelog

- 2026-10-04: Created.
