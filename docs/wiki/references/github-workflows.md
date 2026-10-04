---
title: "GitHub Workflows"
summary: "The four GitHub Actions workflows (CI, keepalive, weekly backup, wiki check): triggers, what they run, the secrets they need."
tags: [ci]
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
  - title: "Keepalive workflow"
    path: .github/workflows/keepalive.yml
  - title: "Backup workflow"
    path: .github/workflows/backup.yml
  - title: "Wiki workflow"
    path: .github/workflows/wiki.yml
  - title: "CI workflow"
    path: .github/workflows/ci.yml
  - title: "Supabase CLI: db dump"
    url: "https://github.com/supabase/cli/blob/develop/apps/cli/docs/supabase/db/dump.md"
    accessed: 2026-10-04
---

# GitHub Workflows

> [!tldr]
> `keepalive.yml` pings Supabase every 5 days so the free-tier project doesn't pause. `backup.yml` dumps the database weekly into a 90-day artifact (schema only, no data). `wiki.yml` runs `pnpm wiki:check` on PRs that touch the wiki. `ci.yml` runs lint, format check, typecheck and tests on every PR and on pushes to `main`.

## Context

The project runs on the Supabase free tier. A free-tier project that sees no activity gets paused, which is why the keepalive exists. See [[references]].

## Workflows

| File | Trigger | Steps | Secrets |
|---|---|---|---|
| `keepalive.yml` | cron `0 6 */5 * *` (06:00 UTC on days 1, 6, 11, … of each month) + manual | `curl -sf $SUPABASE_URL/rest/v1/ingredients?select=id&limit=1` with the `apikey` header | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `backup.yml` | cron `0 3 * * 0` (Sundays 03:00 UTC) + manual | Installs the **latest** Supabase CLI from GitHub releases (unpinned), runs `supabase db dump --db-url …`, uploads `backups/` as an artifact kept 90 days | `SUPABASE_DB_URL` |
| `ci.yml` | every PR, push to `main` | `pnpm install --frozen-lockfile`, then `pnpm lint` (ESLint, errors only fail), `pnpm format:check` (Prettier), `pnpm typecheck`, `pnpm test` on Node 24 (vitest 5 / jsdom 30 need Node 22.22+) | none |
| `wiki.yml` | PRs touching `docs/wiki/**`, `scripts/wiki-check.ts`, `.markdownlint-cli2.jsonc` | `pnpm install --frozen-lockfile`, `pnpm wiki:check` | none |

> [!danger] Neither scheduled workflow has ever succeeded
> As of 2026-10-04, `gh secret list` on `Konstantysz/meal-planner` returns nothing, and every scheduled keepalive and backup run has failed. The keepalive log shows `curl -sf "/rest/v1/ingredients…" -H "apikey: "`, meaning the secrets are empty. So the free-tier project isn't being kept awake and there are no backups. Fix it with [[configure-ci-secrets]].

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
- `gh secret list` and `gh run list` / `gh run view --log-failed` on `Konstantysz/meal-planner`, 2026-10-04
- [Supabase CLI docs for `db dump`](https://github.com/supabase/cli/blob/develop/apps/cli/docs/supabase/db/dump.md), accessed 2026-10-04

## Changelog

- 2026-10-04: Created from legacy `ci.md`. Removed the stale "no GitHub remote" claim and added the wiki workflow, the schema-only backup finding, and the observed failing runs and missing secrets.
- 2026-10-04: Added `ci.yml` (lint, format, typecheck, test).
