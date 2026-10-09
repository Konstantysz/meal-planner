---
title: "Migration History"
summary: "Every database migration with its PR, the problem it fixed, how it was verified on the live project, and the audit findings that are still open."
tags: [database, rls, security]
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
verified_commit: dd67b66
sources:
  - title: "Security hardening"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Share-link RPC"
    path: supabase/migrations/0005_share_link_rpc.sql
  - title: "Atomic recipe save and signup trigger"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "Optional ingredient flag"
    path: supabase/migrations/0007_recipe_ingredient_optional.sql
  - title: "Verification scripts"
    path: supabase/checks/0004_security_hardening.verify.sql
  - title: "Supabase MCP config"
    path: .mcp.json
  - title: "Agent skills lock"
    path: skills-lock.json
---

# Migration History

> [!tldr]
> `0001`–`0003` built the MVP schema. On 2026-10-04 a database audit of the live project found that several RLS policies let any user join any household and anyone with the public anon key list every shared plan. `0004`–`0006` fixed that and made signup and recipe saving robust. `0007` later added the optional-ingredient flag. Each was baselined and verified on the live database with a script in `supabase/checks/`. Read this page first if you missed that work.

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

## Verification

Each of `0004`–`0007` has a script in `supabase/checks/` that creates throwaway users and rows, plays every attack and legit path as `anon` or `authenticated`, and always ends with an exception, so nothing persists. It was run in the SQL editor before merging (baseline) and after the deploy:

| Migration | Before merge | After deploy |
|---|---|---|
| `0004` | `FAIL 8 (14 checks)` | `ALL PASS (14 checks)` |
| `0005` | `FAIL 7 (10 checks)` | `ALL PASS (10 checks)` |
| `0006` | `FAIL 7 (7 checks)` (features missing) | `ALL PASS (7 checks)` |
| `0007` | `FAIL 2 (2 checks)` | `ALL PASS (2 checks)` |

After each deploy the Supabase advisors were re-run. The remaining warnings are deliberate: `get_shared_plan` is executable by `anon` (share links), the other `security definer` functions by `authenticated`. "Unused index" notices are expected on near-empty tables. Leaked-password protection is a dashboard setting.

> [!warning] Uncertain: live results and operational claims
> The repo does not record what the SQL editor returned. The baseline and after-deploy results above, the advisor notes, and the claim that each script ran before merge and after deploy are unverified. Also unverified: the `/share/[token]` 404 reason for `0002`, "Free plan: no downloadable backups" (plan facts are outside the repo), the raw-versus-cooked reading of the seed values, and the ingredient-catalog redesign being undecided. `0007` has a check script, but its live result is not recorded anywhere in the repo.

## Audit findings still open

Found in the same audit, not fixed yet (ranked list: [[known-gaps]]):

- **Ingredient catalog.** One global table, editable by any signed-in user. Unmatched import lines and picker entries become new ingredients with null macros and category `inne`, which count as 0 in recipe macros. Units are free text with no conversion. Seed values look like mixed bases (rice 349 kcal, lentils 116 kcal; the seed does not label them), and every seed row is tagged `source = 'off'`, while the picker writes `manual`. A redesign (global curated catalog plus household-private items, aliases, unit weights) is proposed but not decided. See [[ingredient-database]].
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

## Sources

- `supabase/migrations/*`, `supabase/checks/*`, `supabase/rollbacks/*`
- PRs Konstantysz/meal-planner#2, #5, #6, #7
- Supabase advisors and verification script output, 2026-10-04

## Changelog

- 2026-10-09: Checked the migration SQL for `0001`–`0007`, the rollbacks and checks, and PRs #2, #4–#7 and #13 with `gh`. Added the missing `0007` row. Corrected the backup claim (the workflow ran and failed, it did not never run) and the seed `source` claim (the picker writes `manual`). Left `verified_commit` at dd67b66 because the live results and plan facts are unverifiable from the repo.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-09: Node line changed from "need Node 24" to "should use Node 24 to match CI" (see [[local-dev-setup]]).
- 2026-10-05: Added migration 0007 (optional ingredient flag) and its verification result.
- 2026-10-04: Recorded the 0006 verification result (`ALL PASS`, no orphan recipes, every user has a household).
- 2026-10-04: Created to summarise the 2026-10-04 database audit and migrations 0004–0006.
