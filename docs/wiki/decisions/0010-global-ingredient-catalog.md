---
title: "0010 Global Ingredient Catalog"
summary: "The ingredients table is one catalogue shared by all households, and any signed-in user can insert or update any row, including its macros."
tags: [ingredients, rls, security]
status: stable
owner: "@konstantysz"
created: 2026-10-09
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 180
confidence: medium
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Initial schema and ingredient policies"
    path: supabase/migrations/0001_initial.sql
  - title: "Security hardening (ingredient write policies to authenticated)"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Ingredient data access"
    path: src/lib/db/ingredients.ts
  - title: "Ingredient seed"
    path: supabase/seed.sql
  - title: "Ingredient database"
    path: docs/wiki/concepts/ingredient-database.md
---

# 0010 Global Ingredient Catalog

> [!tldr]
> `ingredients` has no `household_id`. Every household reads the same rows, and any signed-in user can insert or update any row, macros included. The cost is that one household can change data another household relies on. See [[ingredient-database]].

## Context

Macros are stored per 100 g on the ingredient, not on the recipe ([[0006-macros-per-100g]]), so one ingredient row serves every recipe that uses it. Rows come from the seed, from manual creation and from Open Food Facts ([[ingredient-auto-match]]). See [[decisions]].

## Decision

**Status:** accepted (table in commit `78105a1`; write policies opened to any signed-in user in `0001_initial.sql`, narrowed to `authenticated` in `0004_security_hardening.sql`).

- `ing_select` is `using (true)` with no role list, so anonymous users can read the table too.
- `ing_insert` and `ing_update` allow any `authenticated` user (`with check (true)`, `using (true)`).
- A unique index on `lower(name)` makes names unique across the whole catalog.

> [!warning] Uncertain
> The repo calls this a "crowd-sourced catalog, model change pending" (comment in `0004_security_hardening.sql`), but no commit or plan text records why households share one catalog. The reason above is inferred from the schema.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- A household-scoped `ingredients` table (a `household_id` column, as `recipes` has): no cross-household edits, but each household duplicates the same Open Food Facts products.
- A read-only catalog, written only by the seed and backfill scripts: no user edits, but manual creation and import auto-match need a write path.

## Consequences

- Cross-household edits: changing a macro value changes every household's recipe totals. Nothing records who changed what ([[ingredient-database#Known gaps]]).
- The global `lower(name)` index means one household's „Cebula" blocks another's. The picker's `createAndAdd` then fails silently ([[ingredient-database#Invariants and gotchas]]).
- Anonymous visitors can read the whole table.
- Recipes reference ingredients with no delete path, so rows accumulate.
- Tightening this (a `household_id`, or updates limited to `created_by`) needs a migration and a decision about existing rows.

## Related

- [[decisions]]
- [[ingredient-database]]
- [[rls-authorization]]
- [[0006-macros-per-100g]]
- [[0001-rls-is-the-authz-boundary]]

## Sources

- `supabase/migrations/0001_initial.sql` (table, `lower(name)` index, first policies), `supabase/migrations/0004_security_hardening.sql` (write policies to `authenticated`)
- `src/lib/db/ingredients.ts`, `supabase/seed.sql`
- Commit `78105a1` (schema and seed)

## Changelog

- 2026-10-09: Recorded retroactively from the migrations and the ingredient database page. Rationale marked uncertain.
