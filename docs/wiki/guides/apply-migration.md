---
title: "Apply a Database Migration"
summary: "Add a numbered SQL migration with RLS; merging it into main deploys it to production through the Supabase GitHub integration. Verify before and after, and update the wiki."
tags: [database, rls, dev-setup]
status: draft
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: medium
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: 19a988a
sources:
  - title: "Existing migrations"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Example rollback"
    path: supabase/rollbacks/0004_security_hardening.down.sql
  - title: "Example verification script"
    path: supabase/checks/0004_security_hardening.verify.sql
  - title: "Supabase CLI config"
    path: supabase/config.toml
  - title: "Supabase GitHub integration"
    url: "https://supabase.com/docs/guides/deployment/branching/github-integration"
    accessed: 2026-10-04
  - title: "Supabase CLI: db push"
    url: "https://github.com/supabase/cli/blob/develop/apps/cli/docs/supabase/db/push.md"
    accessed: 2026-10-04
---

# Apply a Database Migration

> [!tldr]
> Write `supabase/migrations/000N_<name>.sql` (enable RLS and add policies in the same file), plus a rollback and a verification script. **Merging into `main` applies the migration to production automatically** (Supabase GitHub integration, "Deploy to production"). There is no preview database, so run the verification script by hand before and after the merge. Update [[database-schema]] and any affected concept page in the same PR.

## Context

The hosted project `tfysxpkfbumctfuxcend` is on the Free plan and connected to `Konstantysz/meal-planner` (working directory `.`, production branch `main`, "Deploy to production" on). Branching needs the Pro plan, so the PR check "Supabase Preview" is always skipped and nothing tests the migration before merge. `supabase_migrations.schema_migrations` on the hosted project records `0001`–`0004`, so a deploy applies only newer files. See [[guides]].

> [!warning] Uncertain
> The `0001`–`0004` record is a snapshot from 2026-10-04. It was not re-checked against the live project in this pass (no read-only database query was run), and migrations `0005`–`0007` now exist in the repo.

On deploy, Supabase applies new migrations and deploys Edge Functions and Storage buckets declared in `config.toml`. On a persistent branch such as production, `config.toml` `[api]` and `[auth]` settings are skipped unless a `[remotes]` block opts in, so the local `site_url` doesn't leak to production. The Supabase docs list migrations, Edge Functions and Storage buckets as what gets deployed; `seed.sql` is not in that list.

> [!warning] Uncertain
> Not verified in this pass: that each migration file runs in a single transaction, that the CLI ignores `supabase/rollbacks/`, the `supabase migration repair --status reverted` command, and the `supabase db push --dry-run` behaviour. The Supabase CLI was not installed locally, so these were not run.

## Steps

1. Create the file with the next number and a snake_case name, e.g. `supabase/migrations/0005_share_link_rpc.sql`. Make it safe to run once inside a transaction; Supabase applies each file in one.
2. For every new table: `alter table … enable row level security;` plus its policies, in the same migration. Reuse `is_member_of(household_id)` (see [[rls-authorization]]). Scope member policies `to authenticated` and write `(select auth.uid())`.
3. Add a manual rollback in `supabase/rollbacks/000N_<name>.down.sql`. The CLI ignores that folder.
4. Add a verification script in `supabase/checks/000N_<name>.verify.sql`. Don't use `supabase/tests/`: `supabase test db` runs every file there as pgTAP.
5. **Baseline:** run the verification script in the SQL editor before merging. The attack checks should fail on the current database.
6. Open the PR, let CI pass, merge. Watch the deploy in the dashboard (project home, last migration).
7. **After:** run the verification script again. It must report `ALL PASS`. Then check Database → Advisors.
8. Update `src/lib/types.ts` (types are hand-written) and [[database-schema]].

> [!warning] A merge is a production deploy
> Don't merge a migration PR you haven't baselined. If a deploy breaks something, run the rollback file in the SQL editor, then `supabase migration repair --status reverted 000N`.

### Applying without a merge

`supabase link --project-ref tfysxpkfbumctfuxcend`, then `supabase db push --dry-run` and `supabase db push`. The dry run must list only your new migration. Prefer the merge deploy: it keeps `main` and production in step, and the dashboard records the deploy.

## Verify

- In the SQL editor: `select * from supabase_migrations.schema_migrations order by version;`
- The verification script raises an exception whose message starts with `VERIFY 000N: ALL PASS (n checks)` (or `FAIL n`), followed by the per-check list. It always raises at the end, so nothing it creates is kept.

## Troubleshooting

| Symptom | Fix |
|---|---|
| A new table returns no rows for anyone | RLS is enabled with no policy. Add the policies. |
| An `anon` query fails with `permission denied for function is_member_of` | A policy that applies to `anon` calls `is_member_of`. Scope it `to authenticated`. |
| Seed fails on re-run | `seed.sql` isn't idempotent (see [[database-schema#Seed]]) |

## Examples

```sql
-- 000N_example.sql skeleton
create table pantry_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  text text not null
);
alter table pantry_notes enable row level security;
create policy pantry_notes_all on pantry_notes for all to authenticated
  using (is_member_of(household_id)) with check (is_member_of(household_id));
```

## Related

- [[guides]]
- [[database-schema]]
- [[rls-authorization]]
- [[local-dev-setup]]

## Sources

- `supabase/migrations/*`, `supabase/rollbacks/*`, `supabase/checks/*`, `supabase/config.toml`
- Supabase dashboard, Project Settings → Integrations → GitHub, checked 2026-10-04
- Supabase docs: GitHub integration, "Deploying changes to production", accessed 2026-10-04

## Changelog

- 2026-10-09: Re-verified against a7f8f52. Fixed the example migration name (`0005_share_link_rpc.sql`), the verify-script output wording, and the `config.toml` production behaviour (confirmed by the Supabase docs). Flagged the live-state snapshot and CLI-specific commands as uncertain.
- 2026-10-04: Rewrote for the actual flow: merge into `main` deploys to production. Added rollback and verification steps.
- 2026-10-04: Created as a draft. The CLI flow hasn't been run against the hosted project.
