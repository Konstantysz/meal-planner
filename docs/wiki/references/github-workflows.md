---
title: "GitHub Workflows"
summary: "The four GitHub Actions workflows (CI, keepalive, weekly backup, wiki check): triggers, what they run, the secrets they need."
tags: [ci]
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
verified_commit: 656711c
sources:
  - title: "Keepalive workflow"
    path: .github/workflows/keepalive.yml
  - title: "Backup workflow"
    path: .github/workflows/backup.yml
  - title: "CI workflow"
    path: .github/workflows/ci.yml
  - title: "Main branch ruleset"
    path: .github/rulesets/main-protection.json
  - title: "Supabase CLI: db dump"
    url: "https://github.com/supabase/cli/blob/develop/apps/cli/docs/supabase/db/dump.md"
    accessed: 2026-10-04
---

# GitHub Workflows

> [!tldr]
> `keepalive.yml` pings Supabase every 5 days so the free-tier project doesn't pause. `backup.yml` dumps the database weekly into a 90-day artifact (schema only, no data). `ci.yml` is a sequential pipeline of four jobs, `lint` → `wiki` → `test` → `build`, on every PR and push to `main`. The ruleset file in `.github/rulesets/main-protection.json` requires all four as status checks on `main`. It is active (verified 2026-10-09).

## Context

The project runs on the Supabase free tier. A free-tier project that sees no activity gets paused, which is why the keepalive exists. See [[references]].

## Workflows

| File | Trigger | Steps | Secrets |
|---|---|---|---|
| `keepalive.yml` | cron `0 6 */5 * *` (06:00 UTC on days 1, 6, 11, … of each month) + manual | `curl -sf $SUPABASE_URL/rest/v1/ingredients?select=id&limit=1` with the `apikey` header | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `backup.yml` | cron `0 3 * * 0` (Sundays 03:00 UTC) + manual | Installs the **latest** Supabase CLI from GitHub releases (unpinned), runs `supabase db dump --db-url …`, uploads `backups/` as an artifact kept 90 days | `SUPABASE_DB_URL` |
| `ci.yml` | every PR, push to `main` | Four chained jobs (`needs`), each on Node 24 after `pnpm install --frozen-lockfile`: `lint` (`pnpm lint`, `format:check`, `typecheck`) → `wiki` (full-history checkout; `pnpm wiki:check`, then the informational `pnpm wiki:stale`) → `test` (`pnpm test`) → `build` (`pnpm build` with placeholder `NEXT_PUBLIC_SUPABASE_*` vars, `.next/cache` cached) | none |

> [!danger] Neither scheduled workflow has ever succeeded
> As of 2026-10-09, `gh secret list` on `Konstantysz/meal-planner` returns nothing, and `gh run list --status success` returns no runs for either workflow. The latest keepalive run failed on 2026-10-06 and the latest backup run on 2026-10-04. In the 2026-10-04 keepalive log, `curl -sf "/rest/v1/ingredients…" -H "apikey: "` meant the secrets were empty. So the free-tier project isn't being kept awake and there are no backups. Fix it with [[configure-ci-secrets]].

## Branch protection

`.github/rulesets/main-protection.json` is a GitHub ruleset for the default branch. It blocks direct pushes (changes need a PR), force pushes and deletion, and requires the `lint`, `wiki`, `test` and `build` checks, with the branch up to date. Repository admins can bypass it, so only an admin can push straight to `main` or force-push.

The ruleset is active on `main`: on 2026-10-09 `gh api repos/Konstantysz/meal-planner/rules/branches/main` listed deletion, non-fast-forward, pull_request (0 required approvals) and required_status_checks (`lint`, `wiki`, `test`, `build`, strict) from ruleset 24806035.

A ruleset isn't applied by merging the file; an admin imports it once (already done for this repo) (Settings → Rules → Rulesets → New ruleset → Import a ruleset) or runs:

```bash
gh api -X POST repos/Konstantysz/meal-planner/rulesets --input .github/rulesets/main-protection.json
```

The job names are the required-check names. Rename a job and the ruleset must change too, otherwise PRs wait forever for a check that never reports. The `wiki` job runs on every PR (no path filter) because a required check that is skipped blocks the merge.

## Gotchas

> [!danger] The weekly backup contains no data
> According to the Supabase CLI docs, "the default dump does not contain any data or custom roles". `backup.yml` passes no `--data-only`, so its artifact holds only the schema. Recipes, plans and users can't be restored from it. The fix is a second `supabase db dump --data-only` step, which is not done yet.

- Artifacts expire after 90 days, so there are no long-term backups.
- `*/5` in the day-of-month field resets every month, so the gap between pings varies, for example from the 31st to the 1st.

> [!warning] Uncertain
> The claim that the dump skips Supabase-managed schemas such as `auth` and `storage` was not verified against the Supabase CLI docs in this pass. Also not re-checked: the quoted "does not contain any data or custom roles" wording.

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

- `.github/workflows/keepalive.yml`, `backup.yml`, `ci.yml`, `.github/rulesets/main-protection.json`
- `gh secret list` and `gh run list` / `gh run view --log-failed` on `Konstantysz/meal-planner`, 2026-10-04
- [Supabase CLI docs for `db dump`](https://github.com/supabase/cli/blob/develop/apps/cli/docs/supabase/db/dump.md), accessed 2026-10-04

## Changelog

- 2026-10-09: `wiki` job now checks out full history and runs `pnpm wiki:stale` (informational).
- 2026-10-09: Re-verified workflows and steps against a7f8f52. Confirmed the `main` ruleset is active via `gh api …/rules/branches/main` (an earlier empty result was transient). Updated the secrets and failing-run evidence to 2026-10-09. Flagged the auth/storage dump claim as uncertain.
- 2026-10-04: Created from legacy `ci.md`. Removed the stale "no GitHub remote" claim and added the wiki workflow, the schema-only backup finding, and the observed failing runs and missing secrets.
- 2026-10-04: Added `ci.yml` (lint, format, typecheck, test).
- 2026-10-04: Merged `wiki.yml` into `ci.yml` as a sequential `lint` → `wiki` → `test` → `build` pipeline, added the build stage, and added the `main` ruleset requiring all four checks.
