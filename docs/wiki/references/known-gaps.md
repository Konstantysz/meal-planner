---
title: "Known Gaps"
summary: "Ranked index of known bugs, security gaps and unfinished features, each linking to the page that documents it."
tags: [security, spec]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-10
last_reviewed: 2026-10-10
review_interval_days: 30
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
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

## High

| Gap | Details |
|---|---|
| `/plan` and `/shopping` are statically pre-rendered, so production shows the build week | [[week-plan#Known gaps]] |
| `/api/import/fetch` fetches any URL for any signed-in user (SSRF) | [[api-routes#Routes]] |
| A non-author recipe delete returns 204 and deletes nothing | [[recipe-management#Known gaps]] |
| An RLS-hidden recipe in a slot makes `/api/shopping` throw | [[shopping-list-aggregation#Invariants and gotchas]] |

## Medium

| Gap | Details |
|---|---|
| `usePlan`, `useShoppingList` and `RecipeList` set state synchronously in `useEffect` (`react-hooks/set-state-in-effect` is downgraded to a warning in `eslint.config.mjs`) | [[architecture-overview#Known gaps]] |
| No recipe update endpoint; the edit page is read-only | [[recipe-management#Known gaps]] |
| Recipe macros silently count macro-less ingredients as 0, and picker-created ingredients persist even if the recipe is never saved | [[ingredient-database#Known gaps]] |
| Auto-match creates new ingredients under inflected names as written („czosnku"), and the parser sees model output that may rephrase page lines | [[ingredient-auto-match#Invariants and gotchas]] |
| Per-day macro totals are a stub | [[week-plan#Known gaps]] |
| Plan slots always use 1 serving | [[week-plan#Invariants and gotchas]] |
| Non-gram units add 0 to recipe macros; no unit conversion | [[macro-calculation#Known gaps]] |
| The have-map never syncs; the offline banner promises it will | [[offline-shopping-store#Known gaps]] |
| No service worker | [[offline-shopping-store#Known gaps]] |
| N+1 queries in `/api/shopping` | [[shopping-list-aggregation#Known gaps]] |
| Invites need a UUID; there's no invite UI | [[household-model#Known gaps]] |
| Logged-out API calls get a `/login` redirect instead of a 401 | [[auth-session#Invariants and gotchas]] |
| Most routes and UI, the offline store, `src/lib/db/households.ts` and `src/lib/db/plans.ts` have no tests; there are no RLS tests | [[test-coverage#Not covered]] |

## Low

| Gap | Details |
|---|---|
| `/` is the create-next-app page; metadata says "Create Next App" | [[spec-drift#Leftover scaffold]] |
| The water filter only drops a part whose every „ lub " alternative starts with „woda"; „pomidory + woda" is kept as one ingredient | [[ingredient-auto-match#Invariants and gotchas]] |
| Plan columns shift by a day in timezones west of UTC | [[week-plan#Invariants and gotchas]] |
| The login page has no link to signup | [[auth-session#Known gaps]] |
| Recipe form shows raw Zod JSON on validation errors | [[recipe-management#Known gaps]] |
| Slot recipe name is barely readable in dark mode | [[week-plan#Known gaps]] |
| `useShoppingList` reads `navigator` during render. It works on Node 22.23.2, where the global exists, but it is fragile. | [[offline-shopping-store#Invariants and gotchas]] |
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

- 2026-10-10: Added the inflected-name and model-output row for ingredient auto-match.
- 2026-10-09: Removed the shopping-list `has_macros` row (#15): the route now uses `hasMacros` across all four fields.
- 2026-10-09: Verified all rows at a7f8f52 (grep, build, workflow runs, `gh` for #15 and secrets). Corrected the tests row (`db/ingredients`, `db/recipes`, `db/share`, `extract-route` and `ImportDialog` do have tests) and the `navigator` row (Node-version wording). Confirmed #15 is open and the has_macros mismatch is still in code.
- 2026-10-09: Added the shopping-list `has_macros` mismatch (tracked in #15).
- 2026-10-04: Removed the email-confirmation signup and non-transactional create rows (fixed by migration 0006). Added four gaps found in the 2026-10-04 smoke test.
- 2026-10-04: Removed the token-enumeration and settings wrong-week rows (fixed by migration 0005 and the settings fix).
- 2026-10-04: Removed the household self-join row (fixed by migration 0004).
- 2026-10-04: Created from the gaps collected while verifying the wiki against the code.
