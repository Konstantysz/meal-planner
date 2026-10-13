---
title: "Migration History"
summary: "Every database migration with its PR, the problem it fixed, how it was verified on the live project, and the audit findings that are still open."
tags: [database, rls, security]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-13
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 5ddfe28
sources:
  - title: "Security hardening"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Share-link RPC"
    path: supabase/migrations/0005_share_link_rpc.sql
  - title: "Atomic recipe save and signup trigger"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "Optional ingredient flag"
    path: supabase/migrations/0007_recipe_ingredient_optional.sql
  - title: "Source author and step title"
    path: supabase/migrations/0008_recipe_source_author_step_title.sql
  - title: "Migration 0009"
    path: supabase/migrations/0009_update_recipe_rpc.sql
  - title: "Ingredient ownership and app admins"
    path: supabase/migrations/0010_ingredient_ownership.sql
  - title: "Migration 0011"
    path: supabase/migrations/0011_recipe_image_url.sql
  - title: "Schema integrity"
    path: supabase/migrations/0013_schema_integrity.sql
  - title: "Verification record check"
    path: scripts/migration-record.ts
  - title: "Verification scripts"
    path: supabase/checks/0004_security_hardening.verify.sql
  - title: "Supabase MCP config"
    path: .mcp.json
  - title: "Agent skills lock"
    path: skills-lock.json
---

# Migration History

> [!tldr]
> `0001`–`0003` built the MVP schema. On 2026-10-04 a database audit of the live project found that several RLS policies let any user join any household and anyone with the public anon key list every shared plan. `0004`–`0006` fixed that and made signup and recipe saving robust. `0007` later added the optional-ingredient flag and `0008` the source author and step titles, `0009` the `update_recipe` RPC for editing saved recipes. `0010` (from the 2026-10-13 data audit) limits ingredient edits to the creator or an app admin. `0011` adds the optional recipe photo URL. `0013` adds the integrity rules the app assumed (row positions and amounts, slot dates inside their week, `recipes.updated_at`) and lets a user account be deleted. Every migration from `0004` on (`0004`–`0013`) has a script in `supabase/checks/`; `0008`–`0011` were confirmed live on 2026-10-13. `0008` and `0009` merged without a baseline run first, and CI now blocks that (see Verification). Read this page first if you missed that work.

## Context

Merging into `main` deploys new migrations to production (Supabase GitHub integration, Free plan, no preview branch). That makes the history below also the production change log. How to add the next one: [[apply-migration]]. Current state of every table, policy and function: [[database-schema]]. See [[references]].

## Migrations

| # | PR | What | Why |
|---|---|---|---|
| `0001` | — | Tables, RLS, `is_member_of`, member policies | MVP schema |
| `0002` | — | Anonymous select policies for share links | `/share/[token]` returned 404 for logged-out visitors. Superseded by `0005`. |
| `0003` | — | `create_household_with_owner` RPC | Client-side household insert failed its own read-back under RLS |
| `0004` | Konstantysz/meal-planner#5 | Locked down `hm_insert`, `hm_delete`, `households_insert`, `rec_update`, `st_insert`; `is_owner_of`; revoked `anon` execute on `security definer` functions; `to authenticated` + `(select auth.uid())`; 8 FK indexes | Any signed-in user could add themselves to any household as owner; any member could remove the owner; `anon` could create households; a token could be made for any plan |
| `0005` | Konstantysz/meal-planner#6 | `get_shared_plan(token)` RPC; dropped the `*_via_share_token` policies and the open `st_select`; deleted empty non-Monday plans; `plans_week_start_monday` check | Anyone with the anon key could list every token and read every shared plan. The settings page shared a plan keyed by today, not Monday, which created empty plans. See [[0008-share-link-rpc]]. |
| `0006` | Konstantysz/meal-planner#7 | `on_auth_user_created` trigger creates the household; backfill; idempotent `create_household_with_owner`; `save_recipe` RPC | With email confirmation on, signup left users without a household. `createRecipe` used three inserts and could leave orphan recipes. |
| `0007` | Konstantysz/meal-planner#13 | `recipe_ingredients.optional` boolean (default `false`); `save_recipe` reads the flag per ingredient | Optional ingredients ("ewentualne dodatki") are excluded from recipe macros but still shopped. Rollback: `supabase/rollbacks/0007_recipe_ingredient_optional.down.sql`; check: `supabase/checks/0007_recipe_ingredient_optional.verify.sql`. See [[recipe-management]]. |
| `0008` | Konstantysz/meal-planner#33 | `recipes.source_author` and `recipe_steps.title` (both nullable text); `save_recipe` reads `source_author` and per-step `title` (missing or blank = null) | Records who wrote a recipe (`author_id` is only who saved it) and an optional heading per step. No data migration, nothing populates the fields yet. Rollback: `supabase/rollbacks/0008_recipe_source_author_step_title.down.sql`; check: `supabase/checks/0008_recipe_source_author_step_title.verify.sql`. |
| `0009` | Konstantysz/meal-planner#42 | `update_recipe(p_recipe_id, p_recipe)` RPC (`security invoker`): updates the recipe's columns and replaces its ingredients and steps in one transaction; raises `42501` when RLS leaves 0 rows to update | Recipes could not be edited after saving. An RLS-filtered `UPDATE` returns no error, so the function checks the row count to fail loudly. Needs 0008. Rollback: `supabase/rollbacks/0009_update_recipe_rpc.down.sql` (drops the function only); check: `supabase/checks/0009_update_recipe_rpc.verify.sql`. |
| `0010` | Konstantysz/meal-planner#70 | `app_admins` + `is_app_admin()`; `ingredients.created_by` defaults to `auth.uid()`, `on delete set null`; `ing_insert` requires the caller as creator; `ing_update` needs the creator or an app admin | Any signed-in user could change any ingredient's macros for every household, and no row recorded its creator (all 119 live rows null on 2026-10-13). Must deploy after `0008` and `0009`. See [[0013-ingredient-ownership-and-app-admins]]. |
| `0011` | Konstantysz/meal-planner#43 | `recipes.image_url` (nullable text, check: `http(s)://…`, at most 2048 chars); `save_recipe` and `update_recipe` store it (blank or missing = null) | Recipes had no photo and the redesign covers take one. A hotlinked URL, not Supabase Storage (Free plan). Needs 0008 and 0009. `update_recipe` clears the photo if `image_url` is omitted. Merge first: 0012 (#97), 0013 (#96) and 0014 (#98) follow this one. Rollback: `supabase/rollbacks/0011_recipe_image_url.down.sql` (restores the 0008 `save_recipe` and 0009 `update_recipe`, drops the column and its data); check: `supabase/checks/0011_recipe_image_url.verify.sql`. See [[0014-recipe-photos-hotlinked]]. |
| `0013` | Konstantysz/meal-planner#72 | `recipe_ingredients` / `recipe_steps`: `unique (recipe_id, position)`, `position >= 0`, `amount > 0` when set, step text not blank. `recipes.author_id` nullable and `on delete set null`; `share_tokens.created_by` `on delete cascade`. `recipes.updated_at` maintained by trigger `recipes_set_updated_at`. Triggers `plan_slots_date_in_week` and `plans_week_keeps_slots` (`security invoker`) keep each slot inside its plan's week (`23514`). `execute` on `create_household_with_owner` revoked from `public`, `anon`, `authenticated` | None of these rules was enforced, and deleting an account failed on the `recipes` and `share_tokens` foreign keys. A CHECK cannot read `plans`, hence the triggers. Plain unique constraints suffice: `update_recipe` deletes the old rows before inserting the new ones (the check script reorders rows through it). No data fix: the live data had no violations on 2026-10-13, and the migration fails if that changed. Does not redefine `save_recipe` / `update_recipe` (`0011` does). `0012` is reserved by an open PR. Merge only after 0011 (#92, deployed) and 0012 (#97), and before 0014 (#98). |

## Verification

Each migration from `0004` on has a script in `supabase/checks/` that creates throwaway users and rows, plays every attack and legit path as `anon` or `authenticated`, and always ends with an exception, so nothing persists. It is run in the SQL editor before merging (baseline) and after the deploy. `0008` and `0009` are the exception: they merged without a baseline. On 2026-10-13 the `0010` migration and its rollback were also applied by hand in the SQL editor while baselining; the `FAIL 10` baseline below was taken before that, and the same result after the rollback confirmed the database was back to its pre-`0010` state before the merge deployed it:

> [!note] This table is checked by CI
> `scripts/migration-record.ts` parses it. Keep exactly three columns. A new migration's "Before merge" cell must start with its live result in backticks, for example `` `FAIL 10 (12 checks)` ``, or CI job `db` stays red (`db:order --require-baseline`). Every `(n checks)` in a row must match what the script runs (`pnpm db:verify`).

| Migration | Before merge | After deploy |
|---|---|---|
| `0004` | `FAIL 8 (14 checks)` | `ALL PASS (14 checks)` |
| `0005` | `FAIL 7 (10 checks)` | `ALL PASS (10 checks)` |
| `0006` | `FAIL 7 (7 checks)` (features missing) | `ALL PASS (7 checks)` |
| `0007` | `FAIL 2 (2 checks)` | `ALL PASS (2 checks)` |
| `0008` | not run (merged without a baseline) | `ALL PASS (5 checks)` (2026-10-13) |
| `0009` | not run (merged without a baseline) | `ALL PASS (9 checks)` (2026-10-13; the script numbers them 1–7, 9, 10) |
| `0010` | `FAIL 10 (12 checks)` (2026-10-13) | `ALL PASS (12 checks)` (2026-10-13) |
| `0011` | `FAIL 7 (9 checks)` (live, SQL editor, 2026-10-13) | `ALL PASS (9 checks)` (2026-10-13) |
| `0013` | `FAIL 16 (20 checks)` (live, SQL editor, 2026-10-13) | pending |

After each deploy the Supabase advisors were re-run. The remaining warnings are deliberate: `get_shared_plan` is executable by `anon` (share links), the other `security definer` functions (including `is_app_admin`) by `authenticated`, and `app_admins` has RLS with no policies (INFO) so no client can reach it. "Unused index" notices are expected on near-empty tables. Leaked-password protection is a dashboard setting.

> [!warning] Uncertain: live results and operational claims
> For `0004`–`0007` (2026-10-04) the repo does not record what the SQL editor returned: those baseline and after-deploy results, their advisor notes, and the claim that each script ran before merge and after deploy are unverified. The `0008`–`0010` results were run by a human on 2026-10-13 and pasted into the PR conversation; the `0010` deploy, policies, grants and advisors were also read back with the Supabase MCP the same day. Also unverified: the `/share/[token]` 404 reason for `0002`, "Free plan: no downloadable backups" (plan facts are outside the repo), the raw-versus-cooked reading of the seed values, and the ingredient-catalog redesign being undecided. `0007`'s results in the table come from the same 2026-10-04 session and are equally unverified.

## Audit findings still open

Found in the same audit, not fixed yet (ranked list: [[known-gaps]]):

- **Ingredient catalog.** One global table; since `0010` only the creator or an app admin edits a row. Unmatched import lines and picker entries become new ingredients with null macros and category `inne`, which count as 0 in recipe macros. Units are free text with no conversion. Seed values look like mixed bases (rice 349 kcal, lentils 116 kcal; the seed does not label them), and every seed row is tagged `source = 'off'`, while the picker writes `manual`. A redesign (global curated catalog plus household-private items, aliases, unit weights) is proposed but not decided. See [[ingredient-database]].
- Slots always plan 1 serving, so shopping amounts are per one serving. See [[week-plan]].
- Free plan: no downloadable backups (unverified, see the warning above). The weekly backup workflow has run on schedule twice (2026-09-27 and 2026-10-04), and both runs failed; no Actions secrets are configured. See [[github-workflows]].

## Tooling added in the same session

- `.mcp.json`: the Supabase MCP server for this project, `read_only=true`. Authenticate once with `/mcp` in a terminal `claude` session. Writes to the live database are done by a human in the SQL editor or by merging a migration.
- `.claude/skills/` + `skills-lock.json`: agent skills `caveman`, `caveman-commit`, `database-architect`, `migration` (installed with `npx skills add`). `.prettierignore` skips `.claude/skills/`.
- `.claude/settings.local.json` is gitignored.
- Local machines should use Node 24 to match CI (see [[local-dev-setup]]).

## Examples

```sql
-- What the live database has applied
select version, name from supabase_migrations.schema_migrations order by version;
```

## Related

- [[references]]
- [[database-schema]]
- [[apply-migration]]
- [[rls-authorization]]
- [[known-gaps]]
- [[0008-share-link-rpc]]
- [[0013-ingredient-ownership-and-app-admins]]
- [[0014-recipe-photos-hotlinked]]

## Sources

- `supabase/migrations/*`, `supabase/checks/*`, `supabase/rollbacks/*`
- PRs Konstantysz/meal-planner#2, #5, #6, #7
- Supabase advisors and verification script output, 2026-10-04
- Verification script output for `0008`–`0010` from the SQL editor, and `list_migrations`, `pg_policies`, grants and advisors read with the Supabase MCP, 2026-10-13

## Changelog

- 2026-10-13: Recorded the live 0011 result after deploy (`ALL PASS (9 checks)`).
- 2026-10-13: Recorded the live 0011 baseline from the SQL editor run on 2026-10-13 (`FAIL 7 (9 checks)`); after-deploy result pending.
- 2026-10-13: Added migration 0011 (`recipes.image_url`).
- 2026-10-13: Recorded the live 0013 baseline from the SQL editor run on 2026-10-13.
- 2026-10-13: 0013: three more checks (upsert path, move to another plan, foreign plan fails on RLS); baseline now `FAIL 16 (20 checks)`.
- 2026-10-13: Added migration 0013 (schema integrity, #72) with its PGlite baseline; live results pending.
- 2026-10-13: Scoped the "baselined" claims and the uncertainty warning to what was actually run; recorded the hand-applied `0010` migration and rollback during baselining; bumped `verified_commit`.
- 2026-10-13: Recorded the live 0010 result after deploy (`ALL PASS (12 checks)`); advisors show only the expected `app_admins` (RLS, no policies) and `is_app_admin` notices.
- 2026-10-13: The Verification table is now parsed by CI (`scripts/migration-record.ts`); added the format note.
- 2026-10-13: Recorded the live results for 0008 and 0009 (`ALL PASS` after deploy; no baseline was run before either merge) and the live 0010 baseline.
- 2026-10-13: Added migration 0010 (ingredient ownership and app admins) with its expected baseline; live results pending.
- 2026-10-13: Added migration 0009 (`update_recipe` RPC); the SQL and its check script were written without a Postgres to run them against, live results pending.
- 2026-10-13: Added migration 0008 (`recipes.source_author`, `recipe_steps.title`); live results pending.
- 2026-10-09: Checked the migration SQL for `0001`–`0007`, the rollbacks and checks, and PRs #2, #4–#7 and #13 with `gh`. Added the missing `0007` row. Corrected the backup claim (the workflow ran and failed, it did not never run) and the seed `source` claim (the picker writes `manual`). Left `verified_commit` at dd67b66 because the live results and plan facts are unverifiable from the repo.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-09: Node line changed from "need Node 24" to "should use Node 24 to match CI" (see [[local-dev-setup]]).
- 2026-10-05: Added migration 0007 (optional ingredient flag) and its verification result.
- 2026-10-04: Recorded the 0006 verification result (`ALL PASS`, no orphan recipes, every user has a household).
- 2026-10-04: Created to summarise the 2026-10-04 database audit and migrations 0004–0006.
