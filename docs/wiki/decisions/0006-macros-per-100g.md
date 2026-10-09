---
title: "0006 Macros per 100 g"
summary: "Ingredient macros are stored per 100 g; recipe macros are computed per serving at read time and never stored."
tags: [macros, database]
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
  - title: "Architecture plan (Global Constraints)"
    path: docs/plans/architecture_plan_document.md
  - title: "Macro functions"
    path: src/lib/macros.ts
  - title: "Recipe page (unit-to-grams rule)"
    path: src/app/(app)/recipes/[id]/page.tsx
---

# 0006 Macros per 100 g

> [!tldr]
> The `ingredients` table stores kcal, protein, fat and carbs per 100 g, nullable. Recipe values are computed per serving from those, when a recipe is read.

## Context

Open Food Facts publishes macros per 100 g (`src/lib/off.ts` reads the `_100g` fields). Recipes change (servings, ingredients), so stored totals would go stale. See [[decisions]].

## Decision

**Status:** accepted (original spec, Global Constraints: „Makro w bazie składników: per 100 g. Makro w przepisie: per porcja", macros per 100 g in the ingredient base and per serving in recipes). The preferred units are grams for solids and millilitres for liquids.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- Storing recipe totals: fast reads, but stale after every edit.

## Consequences

- Nothing to recompute when an ingredient's data improves (for example after the OFF backfill).
- Only `g` and `ml` amounts convert to grams. Other units count as 0 (see [[macro-calculation#Known gaps]]).

## Related

- [[decisions]]
- [[macro-calculation]]
- [[ingredient-database]]

## Sources

- Original spec, `docs/plans/architecture_plan_document.md` (Global Constraints), `src/lib/macros.ts`
- Unit-to-grams rule (`ri.unit === 'g' || ri.unit === 'ml'`): `src/app/(app)/recipes/[id]/page.tsx`
- Ingredient columns: `supabase/migrations/0001_initial.sql` (`ingredients`)

## Changelog

- 2026-10-09: Re-verified against `a7f8f52`. Added the recipe page as the source of the unit-to-grams rule. Replaced "nutrients" with "macros" per GLOSSARY.md.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Recorded retroactively.
