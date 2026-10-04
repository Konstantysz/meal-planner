---
title: "Configure CI Secrets"
summary: "Set the three GitHub Actions secrets the keepalive and backup workflows need, then trigger and verify a run."
tags: [ci, database]
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
  - title: "Keepalive workflow"
    path: .github/workflows/keepalive.yml
  - title: "Backup workflow"
    path: .github/workflows/backup.yml
---

# Configure CI Secrets

> [!tldr]
> Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_DB_URL` with `gh secret set`, then `gh workflow run keepalive.yml` and `backup.yml` and check that both go green. Until you do, both scheduled workflows fail.

## Context

As of 2026-10-04 no secrets are set and every scheduled run has failed (see [[github-workflows]]). See [[guides]].

## Prerequisites

- `gh` authenticated with admin rights on `Konstantysz/meal-planner`.
- Supabase dashboard access for the project.

## Steps

1. Copy the values from the Supabase dashboard (Settings → API for the URL and anon key; the database connection string for `SUPABASE_DB_URL`).
2. Set them. `gh` prompts for each value, so nothing lands in your shell history:

   ```bash
   gh secret set SUPABASE_URL -R Konstantysz/meal-planner
   gh secret set SUPABASE_ANON_KEY -R Konstantysz/meal-planner
   gh secret set SUPABASE_DB_URL -R Konstantysz/meal-planner
   ```

3. Trigger both workflows:

   ```bash
   gh workflow run keepalive.yml -R Konstantysz/meal-planner
   gh workflow run backup.yml -R Konstantysz/meal-planner
   ```

## Verify

```bash
gh secret list -R Konstantysz/meal-planner     # three names
gh run list -R Konstantysz/meal-planner --limit 4
```

> [!danger]
> Even when it succeeds, the backup is **schema-only** (see [[github-workflows#Gotchas]]). Add a `--data-only` dump before relying on it.

Download the backup artifact and check its contents.

> [!warning] Uncertain
> Which connection string `supabase db dump --db-url` needs from the dashboard (direct or pooler, and the password encoding) hasn't been tested here. If the dump step fails to connect, try the other one.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Keepalive `exit code 3` | `SUPABASE_URL` is empty or malformed (curl got the URL `/rest/v1/…`) |
| Keepalive `exit code 22` | HTTP error, e.g. a wrong anon key (401) |

## Examples

```bash
gh run view --log-failed -R Konstantysz/meal-planner $(gh run list -R Konstantysz/meal-planner -w "Supabase keepalive" -L 1 --json databaseId -q '.[0].databaseId')
```

## Related

- [[guides]]
- [[github-workflows]]
- [[env-vars]]

## Sources

- `.github/workflows/keepalive.yml`, `backup.yml`; failing-run logs viewed with `gh run view --log-failed` on 2026-10-04

## Changelog

- 2026-10-04: Created as a draft from legacy `ci.md`. The steps haven't been run.
