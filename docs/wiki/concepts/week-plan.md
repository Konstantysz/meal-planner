---
title: "Week Plan"
summary: "Plans keyed by household and Monday week start, slots keyed by date and position, desktop vs mobile views, unavailable-recipe slots and the per-day macro stub."
tags: [plan, ui]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Plan data access"
    path: src/lib/db/plans.ts
  - title: "usePlan hook"
    path: src/hooks/usePlan.ts
  - title: "WeekPlan"
    path: src/components/plan/WeekPlan.tsx
  - title: "Desktop grid"
    path: src/components/plan/WeekPlanDesktop.tsx
  - title: "Mobile list"
    path: src/components/plan/WeekPlanMobile.tsx
  - title: "Plan page"
    path: src/app/(app)/plan/page.tsx
  - title: "Slot schema"
    path: src/lib/schemas.ts
  - title: "Global styles (dark-mode foreground)"
    path: src/app/globals.css
---

# Week Plan

> [!tldr]
> A plan is one household's week, keyed by `week_start_date` (the Monday). A slot is `(plan_id, date, position)` with an optional recipe and planned servings. Writes are upserts on that key. The page shows the current week only. Desktop shows a fixed 5-row grid and mobile shows any number of meals per day. Per-day macro totals are **not implemented**.

## Context

The plan drives the shopping list (see [[shopping-list-aggregation]]) and share links (see [[share-links]]). See [[concepts]] and the [[glossary]] for "slot".

## How it works

- `/plan` computes `startOfWeek(new Date(), { weekStartsOn: 1 })` as `yyyy-MM-dd` and renders `<WeekPlan weekStart>`.
- `usePlan(weekStart)` calls `GET /api/plans?week=`, which runs `getOrCreatePlan` and then `getWeekPlan`. That returns the plan with `slots: plan_slots(*, recipe:recipes(id, name, servings_base))`.
- `assign(date, position, recipeId, servings)` sends `POST /api/plans/[id]/slots` (`upsertSlot`, `onConflict: 'plan_id,date,position'`) and then reloads. `remove(slotId)` sends `DELETE` and reloads.
- `WeekPlan` picks the view with `matchMedia('(min-width: 768px)')`:

| View | Layout | Positions | Slot label |
|---|---|---|---|
| `WeekPlanDesktop` | 7-day table | fixed 0–4 | śniadanie, lunch, obiad, przekąska, kolacja |
| `WeekPlanMobile` | one section per day | any; „+ dodaj posiłek" appends `max + 1` | `slot.label ?? 'posiłek N'` |

- The recipe picker is a dialog inside `WeekPlan.tsx` that loads `GET /api/recipes` and filters by name.

### Unavailable recipes

`plan_slots.recipe_id` is `on delete set null`, so deleting a recipe keeps the slot and nulls the reference. The UI shows „przepis usunięty" (to be „przepis niedostępny", issue #16) when `recipe_id` is set but the joined `recipe` is null. Because deletion nulls `recipe_id`, that state comes mostly from an **unavailable recipe** hidden by RLS, not a deleted one. Covers Review Focus #4; there is no test for it (see [[test-coverage]]).

## Invariants and gotchas

- **Servings are always 1.** `handlePick` calls `assign(…, recipeId, 1)` and there is no control to change it. The shopping list therefore buys for one serving per slot.
- **Labels aren't stored.** `label` is always sent as null. Desktop derives the label from the position and mobile shows „posiłek N", so the same slot is labelled differently in the two views.
- A mobile slot at position 5 or higher doesn't appear in the desktop grid.
- `new Date(plan.week_start_date)` parses `yyyy-MM-dd` as **UTC midnight**. That's fine in Poland (UTC+1/+2), but in a timezone west of UTC the columns shift back one day.
- `getOrCreatePlan` is a select followed by an insert. Two concurrent first loads can race; the loser hits the unique constraint and gets a 500.

## Known gaps

> [!danger] The week is frozen at build time in production
> `src/app/(app)/plan/page.tsx` is a server component that computes `startOfWeek(new Date())`, and nothing marks it dynamic. `pnpm build` reports `/plan` as `○ (Static)`, and the pre-rendered HTML contains `"weekStart":"2026-10-05"` (the week of the 2026-10-09 build). A production deploy keeps showing that week until the next build. `/shopping` has the same problem, and is also `○ (Static)`. `pnpm dev` hides it because dev renders on every request. Fix: compute the week on the client, or opt the page into dynamic rendering.

- **Per-day macros are a stub.** `dayMacros` is filled with `null`, so mobile always shows „brak danych makro". Implementing it needs recipe ingredients per slot (see [[macro-calculation]]).
- No navigation between weeks, and no drag and drop (`@dnd-kit` is installed but unused).
- `assign` and `remove` don't check the response status. They reload either way, so a failed write shows no error.
- In dark mode the recipe name in a slot card is barely readable. It inherits the dark `--foreground` colour (`src/app/globals.css`) on a fixed `bg-white` card. The label is `text-gray-500`, not the name.

## Examples

```ts
// What a slot write looks like
upsertSlot(supabase, { plan_id, date: '2026-10-05', position: 2, label: null, recipe_id, servings: 1 });
```

## Related

- [[concepts]]
- [[shopping-list-aggregation]]
- [[share-links]]
- [[rls-authorization]]

## Sources

- `src/lib/db/plans.ts`, `src/hooks/usePlan.ts`, `src/components/plan/*`, `src/app/(app)/plan/page.tsx`, `src/lib/schemas.ts`

## Changelog

- 2026-10-09: Re-verified against a7f8f52 (no behaviour change in the plan code). Rebuilt the build-week gap from a fresh `pnpm build` (now `2026-10-05`, `/shopping` also static). Corrected the slot-name readability note (the label is grey, not the name) and the error-handling note (`assign`/`remove` don't check the status).
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Added a gap found in the 2026-10-04 smoke test.
- 2026-10-04: Created from legacy `plan.md`. Added the servings-always-1, label mismatch, UTC parsing and create-race notes, plus the build-time week freeze (seen in `pnpm build` output).
