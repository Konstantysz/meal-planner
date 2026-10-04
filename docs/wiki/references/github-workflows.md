---
title: "GitHub Workflows"
summary: "The three GitHub Actions workflows (keepalive, weekly backup, wiki check): triggers, what they run, the secrets they need."
tags: [ci]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 180
confidence: medium
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "Keepalive workflow"
    path: .github/workflows/keepalive.yml
  - title: "Backup workflow"
    path: .github/workflows/backup.yml
  - title: "Wiki workflow"
    path: .github/workflows/wiki.yml
  - title: "Supabase CLI: db dump"
    url: "https://github.com/supabase/cli/blob/develop/apps/cli/docs/supabase/db/dump.md"
    accessed: 2026-10-04
---

# GitHub Workflows

> [!tldr]
> `keepalive.yml` pings Supabase every 5 days so the free-tier project doesn't pause. `backup.yml` dumps the database weekly into a 90-day artifact (schema only, no data). `wiki.yml` runs `pnpm wiki:check` on PRs that touch the wiki. No workflow runs the app's tests or typecheck.

## Context

The project runs on the Supabase free tier. A free-tier project that sees no activity gets paused, which is why the keepalive exists. See [[references]].

## Workflows

| File | Trigger | Steps | Secrets |
|---|---|---|---|
| `keepalive.yml` | cron `0 6 */5 * *` (06:00 UTC on days 1, 6, 11, … of each month) + manual | `curl -sf $SUPABASE_URL/rest/v1/ingredients?select=id&limit=1` with the `apikey` header | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `backup.yml` | cron `0 3 * * 0` (Sundays 03:00 UTC) + manual | Installs the **latest** Supabase CLI from GitHub releases (unpinned), runs `supabase db dump --db-url …`, uploads `backups/` as an artifact kept 90 days | `SUPABASE_DB_URL` |
| `wiki.yml` | PRs touching `docs/wiki/**`, `scripts/wiki-check.ts`, `.markdownlint-cli2.jsonc` | `pnpm install --frozen-lockfile`, `pnpm wiki:check` | none |

> [!warning] Uncertain
> The repo has a GitHub remote (`Konstantysz/meal-planner`), but nothing in the code shows whether the three secrets are configured or whether the scheduled runs succeed. Check the Actions tab before relying on the backups.

## Gotchas

> [!danger] The weekly backup contains no data
> According to the Supabase CLI docs, "the default dump does not contain any data or custom roles". `backup.yml` passes no `--data-only`, so its artifact holds only the schema. Recipes, plans and users can't be restored from it. The fix is a second `supabase db dump --data-only` step, which is not done yet.

- The dump also skips Supabase-managed schemas such as `auth` and `storage`, so user accounts aren't in it either way.
- Artifacts expire after 90 days, so there are no long-term backups.
- `*/5` in the day-of-month field resets every month, so the gap between pings varies, for example from the 31st to the 1st.

## Examples

```bash
gh workflow run keepalive.yml
gh workflow run backup.yml
gh run list --workflow backup.yml --limit 5
```

## Related

- [[references]]
- [[env-vars]]
- [[known-gaps]]

## Sources

- `.github/workflows/keepalive.yml`, `backup.yml`, `wiki.yml`
- [Supabase CLI docs for `db dump`](https://github.com/supabase/cli/blob/develop/apps/cli/docs/supabase/db/dump.md), accessed 2026-10-04

## Changelog

- 2026-10-04: Created from legacy `ci.md`. Removed the stale "no GitHub remote" claim and added the wiki workflow and the schema-only backup finding.
