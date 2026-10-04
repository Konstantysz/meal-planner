---
title: "Migration History"
summary: "Every database migration with its PR, the problem it fixed, how it was verified on the live project, and the audit findings that are still open."
tags: [database, rls, security]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: dd67b66
sources:
  - title: "Security hardening"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Share-link RPC"
    path: supabase/migrations/0005_share_link_rpc.sql
  - title: "Atomic recipe save and signup trigger"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "Verification scripts"
    path: supabase/checks/0004_security_hardening.verify.sql
  - title: "Supabase MCP config"
    path: .mcp.json
  - title: "Agent skills lock"
    path: skills-lock.json
---

# Migration History

> [!tldr]
> `0001`–`0003` built the MVP schema. On 2026-10-04 a database audit of the live project found that several RLS policies let any user join any household and anyone with the public anon key list every shared plan. `0004`–`0006` fixed that and made signup and recipe saving robust. Each was baselined and verified on the live database with a script in `supabase/checks/`. Read this page first if you missed that work.

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

## Verification

Each of `0004`–`0006` has a script in `supabase/checks/` that creates throwaway users and rows, plays every attack and legit path as `anon` or `authenticated`, and always ends with an exception, so nothing persists. It was run in the SQL editor before merging (baseline) and after the deploy:

| Migration | Before merge | After deploy |
|---|---|---|
| `0004` | `FAIL 8 (14 checks)` | `ALL PASS (14 checks)` |
| `0005` | `FAIL 7 (10 checks)` | `ALL PASS (10 checks)` |
| `0006` | every check fails (features missing) | to be filled in after the deploy |

After `0004` and `0005`, the Supabase advisors were re-run. The remaining warnings are deliberate: `get_shared_plan` is executable by `anon` (public links), the other `security definer` functions by `authenticated`. "Unused index" notices are expected on near-empty tables. Leaked-password protection is a dashboard setting.

## Audit findings still open

Found in the same audit, not fixed yet (ranked list: [[known-gaps]]):

- **Ingredient catalog.** One global table, editable by any signed-in user. Unmatched import lines and picker entries become new ingredients with null macros and category `inne`, which count as 0 in recipe macros. Units are free text with no conversion. Seed data mixes raw and cooked values (rice 349 kcal dry vs lentils 116 cooked), and `source = 'off'` on hand-entered rows. A redesign (global curated catalog plus household-private items, aliases, unit weights) is proposed but not decided. See [[ingredient-database]].
- Slots always use 1 serving, so shopping amounts are per one portion. See [[week-plan]].
- Free plan: no downloadable backups, and the backup workflow has never run. See [[github-workflows]].

## Tooling added in the same session

- `.mcp.json`: the Supabase MCP server for this project, `read_only=true`. Authenticate once with `/mcp` in a terminal `claude` session. Writes to the live database are done by a human in the SQL editor or by merging a migration.
- `.claude/skills/` + `skills-lock.json`: agent skills `caveman`, `caveman-commit`, `database-architect`, `migration` (installed with `npx skills add`). `.prettierignore` skips `.claude/skills/`.
- `.claude/settings.local.json` is gitignored.
- Local machines need Node 24 (see [[local-dev-setup]]).

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

- 2026-10-04: Created to summarise the 2026-10-04 database audit and migrations 0004–0006.
