---
title: "0015 Recipe Forks"
summary: "Only a recipe's saving member or an app admin changes or deletes it; any other member edits their own fork, linked to the original."
tags: [recipes, rls, security]
aliases: []
status: review
owner: "@konstantysz"
created: 2026-10-13
updated: 2026-10-13
last_reviewed: null
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 1c21fbf
sources:
  - title: "Recipe forks"
    path: supabase/migrations/0014_recipe_fork.sql
  - title: "0014 rollback"
    path: supabase/rollbacks/0014_recipe_fork.down.sql
  - title: "0014 verification script"
    path: supabase/checks/0014_recipe_fork.verify.sql
  - title: "Recipe data access"
    path: src/lib/db/recipes.ts
  - title: "Edit access"
    path: src/lib/recipe-access.ts
  - title: "Fork button"
    path: src/components/recipes/ForkEditButton.tsx
---

# 0015 Recipe Forks

> [!tldr]
> A recipe is changed or deleted only by the member who saved it (`author_id`) or an app admin. Any other member who edits it gets a fork: their own copy, linked to the original through `forked_from_id`, which they then edit. The original and the slots planned with it stay untouched.

## Context

Since migration 0004, `rec_update` let any member edit any recipe of their household, and `ri_all` / `rs_all` let them rewrite its ingredients and steps directly. With `update_recipe` (0009) and the edit form, that became one click: one member's edit silently replaced another member's recipe, including in weeks already planned. `rec_delete` was already author-only, but a refused delete returned 204, so the UI looked as if it had worked. Issue Konstantysz/meal-planner#75. See [[decisions]].

## Decision

**Status:** accepted, pending deploy (migration `0014_recipe_fork.sql`, issue Konstantysz/meal-planner#75).

- `rec_update` and `rec_delete` need `author_id = auth.uid()` or `is_app_admin()` ([[0013-ingredient-ownership-and-app-admins]]). `rec_update`'s `with check` repeats that rule (an author cannot hand a recipe to someone else) and keeps the household check from 0004.
- The recipe children follow the parent: reads (`ri_select`, `rs_select`) keep the household rule, writes (`ri_insert|update|delete`, `rs_insert|update|delete`) need the parent's author or an app admin. `save_recipe` and `update_recipe` are unchanged and keep working for authors.
- `fork_recipe(p_recipe_id) returns uuid` copies a recipe the caller can read, with its recipe ingredients and steps, as a new recipe authored by the caller, in one transaction. It copies the `recipes` columns as of migration 0010. Open PRs add more: #92 (`recipes.image_url`, 0011) and the 0013 PR (`recipes.updated_at`, nullable `author_id`); whichever of them merges after 0014 must extend `fork_recipe` in a new migration. The copy's name gets the suffix „ (kopia)" (once, within the form's 200-character limit). It goes into the source's household when the caller is a member, otherwise the caller's own. `recipes.forked_from_id` records the source (on delete set null).
- One fork per member and source: when the caller already has a fork of the source in that household, `fork_recipe` returns the most recent one instead of creating another, so a repeated „Edytuj" opens the same fork.
- A recipe that is readable while its ingredients or steps are not (`public_link` from outside the household) raises `22023` instead of producing an empty fork.
- `fork_recipe` is `security invoker`. Each step is one RLS already allows: reading the source (`rec_select`, `ri_select`, `rs_select`), inserting a recipe the caller authors into a household they belong to (`rec_insert`), and inserting children of that recipe (`ri_insert`, `rs_insert`). Definer rights would only add a privilege to get wrong. `execute` is revoked from `public` and `anon`.
- „Edytuj" on someone else's recipe calls `POST /api/recipes/[id]/fork` and opens the fork's edit page. The direct edit URL of such a recipe offers „Utwórz kopię i edytuj" instead of forking on page load, because a page load must not write.
- Refusals are loud. `update_recipe` already raises `42501` when RLS filters its update (403). `DELETE /api/recipes/[id]` asks for the deleted rows back and returns 403 when there are none.
- Plan slots are never rewritten: a slot keeps the recipe it was planned with.

## Alternatives considered

- **Keep household-wide edits**: the simplest model, but one member's change silently rewrites what the others cooked and planned, with no way to get the old version back.
- **Version history on `recipes`** (every edit a new row, slots pin a version): keeps everyone's view, but needs a versions table, slot migration and UI for picking versions. Forks give each member their own copy for a fraction of that.
- **Fork on save instead of on „Edytuj"**: no fork is left behind when the member cancels, but the edit form would need a separate save path that forks and edits in one call, and the issue asked for fork-then-edit. A cancelled edit leaves a fork, but a repeated „Edytuj" reuses it, and its author can delete it.
- **`fork_recipe` as `security definer`** with its own read check: it would also let a fork land in a household the caller does not belong to if the check were wrong. Not needed, since RLS already allows every step.

## Consequences

- A member can no longer correct a typo in another member's recipe in place; they fork it or ask the author (or an app admin).
- An app admin edits only recipes they can read (`rec_select` is unchanged), in practice those of their own households.
- Forks do not follow later changes to the original, and nothing merges them back. A fork of a fork points at its direct source.
- Deleting the original keeps its forks; their `forked_from_id` becomes null.
- Reusing an existing fork is best-effort under concurrency: `fork_recipe` checks for the caller's fork and then inserts, with no unique constraint behind it, so two simultaneous calls by the same caller can create two forks. The extra fork is an ordinary recipe its author can delete.
- New recipe columns must be added to `fork_recipe`'s copy. It copies the `recipes` columns as of migration 0010. Open PRs add more: #92 (`recipes.image_url`, 0011) and the 0013 PR (`recipes.updated_at`, nullable `author_id`); whichever of them merges after 0014 must extend `fork_recipe` in a new migration.

## Related

- [[decisions]]
- [[recipe-management]]
- [[rls-authorization]]
- [[0001-rls-is-the-authz-boundary]]
- [[0013-ingredient-ownership-and-app-admins]]
- [[migration-history]]

## Sources

- `supabase/migrations/0014_recipe_fork.sql`, `supabase/rollbacks/0014_recipe_fork.down.sql`, `supabase/checks/0014_recipe_fork.verify.sql`
- `supabase/migrations/0004_security_hardening.sql` (the previous `rec_update`, `ri_all`, `rs_all`)
- `src/lib/db/recipes.ts` (`forkRecipe`, `deleteRecipe`), `src/lib/recipe-access.ts` (`canEditRecipe`), `src/components/recipes/ForkEditButton.tsx`
- Issue Konstantysz/meal-planner#75

## Changelog

- 2026-10-13: Noted that fork reuse is best-effort under concurrent calls.
- 2026-10-13: A repeated fork returns the caller's existing fork; new forks are named „… (kopia)"; an empty copy raises `22023`; clarified which columns are copied.
- 2026-10-13: Created with migration 0014.
