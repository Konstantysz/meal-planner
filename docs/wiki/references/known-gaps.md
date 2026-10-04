---
title: "Known Gaps"
summary: "Ranked index of known bugs, security gaps and unfinished features, each linking to the page that documents it."
tags: [security, spec]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 30
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "Initial schema and RLS"
    path: supabase/migrations/0001_initial.sql
  - title: "Backup workflow"
    path: .github/workflows/backup.yml
  - title: "Plan page"
    path: src/app/(app)/plan/page.tsx
  - title: "Settings page"
    path: src/app/(app)/settings/page.tsx
---

# Known Gaps

> [!tldr]
> This is a triage list of what is broken, unsafe or unfinished, most severe first. Each row is one line plus a link. The details live on the linked page, and so does the fix when it lands: when you fix a gap, update that page and delete the row here.

## Context

This page is an index only, so it doesn't duplicate content (see [[RULES]]). Severities follow the code-review scale: critical (security or data loss), high (bug), medium (maintainability), low. See [[references]].

## Critical

| Gap | Details |
|---|---|
| Keepalive and backup have never succeeded: no Actions secrets are configured | [[github-workflows#Workflows]] |
| The weekly backup is a schema-only dump. No data can be restored even once the secrets are set. | [[github-workflows#Gotchas]] |
| Anyone with the anon key can list every share token, and through them every shared plan and its recipes | [[share-links#Known gaps]] |
| Any signed-in user can add themselves (even as `owner`) to any household whose UUID they know | [[rls-authorization#Known gaps]] |

## High

| Gap | Details |
|---|---|
| `/plan` and `/shopping` are statically pre-rendered, so production shows the build week | [[week-plan#Known gaps]] |
| The settings page shares the plan keyed by **today**, not the week's Monday, so it's usually an empty plan | [[share-links#Invariants and gotchas]] |
| `/api/import/fetch` fetches any URL for any signed-in user (SSRF) | [[api-routes#Routes]] |
| Signup with email confirmation enabled leaves a user without a household | [[household-model#Known gaps]] |
| A non-author recipe delete returns 204 and deletes nothing | [[recipe-management#Known gaps]] |
| `createRecipe` isn't transactional, so it can leave orphan recipe rows | [[recipe-management#Known gaps]] |
| An RLS-hidden recipe in a slot makes `/api/shopping` throw | [[shopping-list-aggregation#Invariants and gotchas]] |
| Pre-rendering `/shopping` probably throws on Node 20 (`navigator` access) | [[offline-shopping-store#Invariants and gotchas]] |

## Medium

| Gap | Details |
|---|---|
| `usePlan`, `useShoppingList` and `RecipeList` set state synchronously in `useEffect` (`react-hooks/set-state-in-effect` is downgraded to a warning in `eslint.config.mjs`) | [[architecture-overview#Known gaps]] |
| No recipe update endpoint; the edit page is read-only | [[recipe-management#Known gaps]] |
| Per-day macro totals are a stub | [[week-plan#Known gaps]] |
| Plan slots always use 1 serving | [[week-plan#Invariants and gotchas]] |
| Non-gram units add 0 to recipe macros; no unit conversion | [[macro-calculation#Known gaps]] |
| The have-map never syncs; the offline banner promises it will | [[offline-shopping-store#Known gaps]] |
| No service worker | [[offline-shopping-store#Known gaps]] |
| N+1 queries in `/api/shopping` | [[shopping-list-aggregation#Known gaps]] |
| Invites need a UUID; there's no invite UI | [[household-model#Known gaps]] |
| Logged-out API calls get a `/login` redirect instead of a 401 | [[auth-session#Invariants and gotchas]] |
| Most of `src/lib/db`, the offline store, routes and UI have no tests; there are no RLS tests | [[test-coverage#Not covered]] |

## Low

| Gap | Details |
|---|---|
| `/` is the create-next-app page; metadata says "Create Next App" | [[spec-drift#Leftover scaffold]] |
| Plan columns shift by a day in timezones west of UTC | [[week-plan#Invariants and gotchas]] |
| The seed isn't idempotent | [[database-schema#Seed]] |
| `@dnd-kit` is installed but unused | [[spec-drift#Planned but not built]] |

## Examples

```bash
# Find every deliberate shortcut marked in code
git grep -n "ponytail:" -- src scripts
```

## Related

- [[references]]
- [[spec-drift]]
- [[test-coverage]]
- [[rls-authorization]]

## Sources

- The linked concept and reference pages, each verified at 656711c
- `pnpm build` output on the `docs/wiki` branch (static `/plan` and `/shopping`)

## Changelog

- 2026-10-04: Created from the gaps collected while verifying the wiki against the code.
