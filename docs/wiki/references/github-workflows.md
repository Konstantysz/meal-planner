---
title: "GitHub Workflows"
summary: "The four GitHub Actions workflows (CI, keepalive, weekly backup, wiki check): triggers, what they run, the secrets they need."
tags: [ci]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-13
last_reviewed: 2026-10-09
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 7b03971
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
> `keepalive.yml` pings Supabase every 5 days so the free-tier project doesn't pause. `backup.yml` dumps the database weekly into a 90-day artifact (schema only, no data). `ci.yml` is a sequential pipeline, `lint` → `wiki` → `test` → `build`, plus `db` after `lint`, on every PR and push to `main`. The ruleset file in `.github/rulesets/main-protection.json` lists all five as required status checks on `main`. It is active (verified 2026-10-09).

## Context

The project runs on the Supabase free tier. A free-tier project that sees no activity gets paused, which is why the keepalive exists. See [[references]].

## Workflows

| File | Trigger | Steps | Secrets |
|---|---|---|---|
| `keepalive.yml` | cron `0 6 */5 * *` (06:00 UTC on days 1, 6, 11, … of each month) + manual | `curl -sf $SUPABASE_URL/rest/v1/ingredients?select=id&limit=1` with the `apikey` header | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `backup.yml` | cron `0 3 * * 0` (Sundays 03:00 UTC) + manual | Installs the **latest** Supabase CLI from GitHub releases (unpinned), runs `supabase db dump --db-url …`, uploads `backups/` as an artifact kept 90 days | `SUPABASE_DB_URL` |
| `ci.yml` | every PR, push to `main` | Four chained jobs (`needs`), each on Node 24 after `pnpm install --frozen-lockfile`: `lint` (`pnpm lint`, `format:check`, `typecheck`) → `wiki` (full-history checkout; `pnpm wiki:check`, then the informational `pnpm wiki:stale`) → `test` (`pnpm test`) → `build` (`pnpm build` with placeholder `NEXT_PUBLIC_SUPABASE_*` vars, `.next/cache` cached) | none |
| `ci.yml`, job `db` | every PR, push to `main` | After `lint`: full-history checkout; on PRs `pnpm db:order "origin/$BASE_REF" --require-baseline` (new migrations above the base branch with rollback and check, and their live baseline recorded in [[migration-history]]; applied migrations unchanged); then `pnpm db:verify` (migrations, verification scripts and rollbacks on PGlite; every check count recorded in [[migration-history]] matches its script) | none |

> [!danger] Neither scheduled workflow has ever succeeded
> As of 2026-10-09, `gh secret list` on `Konstantysz/meal-planner` returns nothing, and `gh run list --status success` returns no runs for either workflow. The latest keepalive run failed on 2026-10-06 and the latest backup run on 2026-10-04. In the 2026-10-04 keepalive log, `curl -sf "/rest/v1/ingredients…" -H "apikey: "` meant the secrets were empty. So the free-tier project isn't being kept awake and there are no backups. Fix it with [[configure-ci-secrets]].

## Branch protection

`.github/rulesets/main-protection.json` is a GitHub ruleset for the default branch. It blocks direct pushes (changes need a PR), force pushes and deletion, and requires the `lint`, `wiki`, `db`, `test` and `build` checks, with the branch up to date. Repository admins can bypass it, so only an admin can push straight to `main` or force-push.

A merge of a branch that is behind `main` fails with `Repository rule violations found` and `N of N required status checks are expected`, even when every check on the PR is green. Update the branch ("Update branch" on the PR, a merge commit), wait for CI, then merge. Each merge puts the other open PRs behind again.

The ruleset is active on `main`: on 2026-10-09 `gh api repos/Konstantysz/meal-planner/rules/branches/main` listed deletion, non-fast-forward, pull_request (0 required approvals) and required_status_checks (`lint`, `wiki`, `test`, `build`, strict) from ruleset 24806035.

> [!warning] TODO for @Konstantysz (Kostek), asked by Radek on 2026-10-13: make `db` a required check
> `db` was added to `.github/rulesets/main-protection.json` on 2026-10-13, but GitHub still enforces the old ruleset. Until a repository admin syncs ruleset 24806035 (`main-protection`) from the file, GitHub requires only `lint`, `wiki`, `test` and `build`, so a migration PR can be merged while `db` is red, and `db` is the check that holds a migration until its live baseline is recorded. Only a repository admin can do this; agents cannot.
>
> What to do (about two minutes, details in [[github-workflows#Syncing the ruleset after editing the file]]):
>
> 1. `gh api -X PUT repos/Konstantysz/meal-planner/rulesets/24806035 --input .github/rulesets/main-protection.json` from an up-to-date `main` (or add `db` by hand: Settings → Rules → Rulesets → `main-protection` → "Require status checks to pass" → "Add checks" → `db` → "Save changes").
> 2. Check that the required checks now include `db`: `gh api repos/Konstantysz/meal-planner/rules/branches/main --jq '.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'`.
> 3. Tell an agent "the ruleset is synced" so it removes this request everywhere (the list below), or remove it yourself.
>
> Remove this request when step 2 shows `db`: this callout, the "Open request for Konstantysz" block at the top of `AGENTS.md`, and the `db` row in [[known-gaps]]. Agents show this request first in a session with Kostek, or when the task touches CI, merging or branch protection.

### Syncing the ruleset after editing the file

Merging a change to `.github/rulesets/main-protection.json` does nothing on GitHub by itself. A repository admin (today @Konstantysz, the repo owner) applies it:

1. Wait until the change is merged into `main` and CI has run there once, so GitHub has seen every check name the file lists (`db` included).
2. Confirm the ruleset id. It is `24806035`, named `main-protection`:

   ```bash
   gh api repos/Konstantysz/meal-planner/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'
   ```

3. From the repo root on an up-to-date `main`, overwrite the live ruleset with the file:

   ```bash
   gh api -X PUT repos/Konstantysz/meal-planner/rulesets/24806035 --input .github/rulesets/main-protection.json
   ```

   Without `gh`: Settings → Rules → Rulesets → `main-protection` → "Require status checks to pass" → "Add checks" → type `db` → select it → "Save changes".
4. Check that `main` now requires five checks. The output must list `lint`, `wiki`, `db`, `test` and `build`:

   ```bash
   gh api repos/Konstantysz/meal-planner/rules/branches/main --jq '.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'
   ```

5. Remove the TODO callout above (and the other places it lists) and record the date in this page's Changelog.

First-time setup only (already done for this repo, ruleset 24806035): an admin imports the file once (Settings → Rules → Rulesets → New ruleset → Import a ruleset) or runs:

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

- 2026-10-13: Turned the `db` ruleset warning into an explicit TODO for Konstantysz with the commands and the list of places to remove it from once done.
- 2026-10-13: Job `db` now requires the live baseline of a new migration in [[migration-history]] and checks the recorded check counts.
- 2026-10-13: Explained the "required status checks are expected" merge error on a branch behind `main`.
- 2026-10-13: Added the step-by-step ruleset sync for admins.
- 2026-10-13: Added CI job `db` (`pnpm db:order`, `pnpm db:verify`) and listed it in the ruleset file.
- 2026-10-09: `wiki` job now checks out full history and runs `pnpm wiki:stale` (informational).
- 2026-10-09: Re-verified workflows and steps against a7f8f52. Confirmed the `main` ruleset is active via `gh api …/rules/branches/main` (an earlier empty result was transient). Updated the secrets and failing-run evidence to 2026-10-09. Flagged the auth/storage dump claim as uncertain.
- 2026-10-04: Created from legacy `ci.md`. Removed the stale "no GitHub remote" claim and added the wiki workflow, the schema-only backup finding, and the observed failing runs and missing secrets.
- 2026-10-04: Added `ci.yml` (lint, format, typecheck, test).
- 2026-10-04: Merged `wiki.yml` into `ci.yml` as a sequential `lint` → `wiki` → `test` → `build` pipeline, added the build stage, and added the `main` ruleset requiring all four checks.
