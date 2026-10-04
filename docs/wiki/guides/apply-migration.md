---
title: "Apply a Database Migration"
summary: "Add a numbered SQL migration with RLS, apply it to the linked Supabase project with the CLI, and update the wiki."
tags: [database, rls, dev-setup]
status: draft
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: medium
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "Existing migrations"
    path: supabase/migrations/0003_household_signup_rpc.sql
  - title: "Supabase CLI config"
    path: supabase/config.toml
  - title: "Supabase CLI: db push"
    url: "https://github.com/supabase/cli/blob/develop/apps/cli/docs/supabase/db/push.md"
    accessed: 2026-10-04
  - title: "Supabase CLI reference"
    url: "https://github.com/supabase/cli/blob/develop/apps/cli/docs/go-cli-reference.md"
    accessed: 2026-10-04
---

# Apply a Database Migration

> [!tldr]
> Write `supabase/migrations/000N_<name>.sql` (enable RLS and add policies in the same file), `supabase link --project-ref tfysxpkfbumctfuxcend`, check with `supabase db push --dry-run`, then push. Update [[database-schema]] and any affected concept page in the same PR.

## Context

The repo has three hand-numbered migrations (`0001`–`0003`). How they reached the hosted project isn't recorded in the repo. See [[guides]].

## Prerequisites

- Supabase CLI installed (it isn't a project dependency).
- The database password for `supabase link`.

## Steps

1. Create the file with the next number and a snake_case name, e.g. `supabase/migrations/0004_share_token_lookup_rpc.sql`.
2. For every new table: `alter table … enable row level security;` plus its policies, in the same migration. Reuse `is_member_of(household_id)` (see [[rls-authorization]]).
3. Link once:

   ```bash
   supabase link --project-ref tfysxpkfbumctfuxcend
   ```

4. Preview, then apply:

   ```bash
   supabase db push --dry-run
   supabase db push
   ```

5. Update `src/lib/types.ts` (types are hand-written) and [[database-schema]].

> [!warning] Uncertain: migration history on the hosted project
> `db push` records applied versions in `supabase_migrations.schema_migrations`. If `0001`–`0003` were applied some other way (SQL editor, MCP), that table is empty and `--dry-run` will list them as pending. Applying them again would fail. In that case, mark them applied first: `supabase migration repair --status applied 0001 0002 0003`.

## Verify

- `--dry-run` lists only your new migration.
- In the SQL editor: `select * from supabase_migrations.schema_migrations order by version;`

## Troubleshooting

| Symptom | Fix |
|---|---|
| A new table returns no rows for anyone | RLS is enabled with no policy. Add the policies. |
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
create policy pantry_notes_all on pantry_notes for all
  using (is_member_of(household_id)) with check (is_member_of(household_id));
```

## Related

- [[guides]]
- [[database-schema]]
- [[rls-authorization]]
- [[local-dev-setup]]

## Sources

- `supabase/migrations/*`, `supabase/config.toml`
- Supabase CLI docs for `db push`, `link` and `migration repair`, accessed 2026-10-04

## Changelog

- 2026-10-04: Created as a draft. The CLI flow hasn't been run against the hosted project.
