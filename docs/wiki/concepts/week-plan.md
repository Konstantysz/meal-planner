---
title: "Week Plan"
summary: "Plans keyed by household and Monday week start, week navigation by ?week=, slots keyed by date and position, moving slots (drag and drop, picker), servings stepper, desktop vs mobile views and unavailable-recipe slots."
tags: [plan, ui]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-13
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 5ddfe28
sources:
  - title: "Slot PATCH route"
    path: src/app/api/plans/[id]/slots/[slotId]/route.ts
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
  - title: "Day macro totals"
    path: src/lib/day-macros.ts
  - title: "Day totals cell"
    path: src/components/plan/DayTotals.tsx
  - title: "Slot schema"
    path: src/lib/schemas.ts
  - title: "Slot date rule (migration 0013)"
    path: supabase/migrations/0013_schema_integrity.sql
  - title: "Global styles (dark-mode foreground)"
    path: src/app/globals.css
---

# Week Plan

> [!tldr]
> A plan is one household's week, keyed by `week_start_date` (the Monday). A slot is `(plan_id, date, position)` with an optional recipe and planned servings. Adding a slot is an upsert on that key; moving one or changing its servings is a `PATCH`. `/plan?week=YYYY-MM-DD` shows any week, with previous / next / today controls. Desktop shows a fixed 5-row grid with drag and drop, and mobile shows any number of meals per day. Each day shows its macro total, or „brak danych makro" when any ingredient lacked data (#44).

## Context

The plan drives the shopping list (see [[shopping-list-aggregation]]) and share links (see [[share-links]]). See [[concepts]] and the [[glossary]] for "slot".

## How it works

- `/plan` (rendered per request: `await connection()`, and it reads `searchParams`) turns `?week=` into a Monday with `resolveWeek` (`normalizeWeekStart`, falling back to the current week when missing or malformed) and renders `<WeekPlan key={weekStart} weekStart>`. The `key` remounts the plan on a week change. `/` redirects to `/plan` and forwards `?week=`. `WeekNav` links to `shiftWeek(weekStart, ±1)` and to plain `/plan` for „Dziś", so the URL always carries the week.
- `usePlan(weekStart)` calls `GET /api/plans?week=`, which runs `getOrCreatePlan` and then `getWeekPlan`. That returns the plan with `slots: plan_slots(*, recipe:recipes(id, name, servings_base, ingredients:recipe_ingredients(amount, unit, optional, ingredients(<macro columns>))))`: one query for the whole week, so day totals need no per-slot fetching.
- `assign(date, position, recipeId, servings)` sends `POST /api/plans/[id]/slots` (`upsertSlot`, `onConflict: 'plan_id,date,position'`) and then reloads. `remove(slotId)` sends `DELETE` and reloads. `update(slotId, patch)` sends `PATCH /api/plans/[id]/slots/[slotId]` with `date`, `position` and/or `servings` (`PlanSlotPatchSchema`). The screen updates optimistically (`applySlotPatch`) and then reloads. Every write that fails shows a Polish message in a `role="alert"` line and reloads, so the screen matches the server again.
- `WeekPlan` renders both views and CSS shows one: the desktop table from the `lg` breakpoint (1024 px), the mobile list below it. There is no JavaScript viewport check, so nothing re-lays out after hydration. Slots are tinted by position with the `slot-0`…`slot-4` tokens; empty slots and positions above 4 stay neutral.

| View | Layout | Positions | Slot label |
|---|---|---|---|
| `WeekPlanDesktop` | 7-day table | fixed 0–4 | śniadanie, lunch, obiad, przekąska, kolacja |
| `WeekPlanMobile` | one section per day | any; „+ dodaj posiłek" appends `max + 1` | `slot.label ?? 'posiłek N'` |

- `WeekPlan` loads `GET /api/recipes` once and shares it between the recipe picker (a sheet that filters by name) and the desktop recipe strip.

### Day macro totals

`computeDayMacros(plan.slots)` (`src/lib/day-macros.ts`, pure) runs in both views on the already loaded plan, so the stepper and moves update the totals at once. Per slot with a recipe: `recipeMacros` sums the base recipe (rules in [[macro-calculation]]), `perServing` divides by `servings_base`, and the result is multiplied by the slot's planned servings. A day is **incomplete** when any slot has a non-optional ingredient with a unit other than `g`/`ml`, no amount, no macros or no ingredient row; a recipe with no counted ingredients; an unavailable recipe; or a `servings_base` of 0 or less. `DayTotals` then shows „brak danych makro" instead of a partial sum that would read as a real total. A day with no recipe slot shows nothing. Desktop renders the totals in a „Razem" footer row, mobile in each day's heading.

### Moving slots and servings

- **Move = one `PATCH`.** `updateSlot` runs a single `UPDATE … WHERE id AND plan_id`, so a move is atomic. Moving onto an occupied position violates `unique (plan_id, date, position)` and returns 409 (`SlotOccupiedError`); no matching row (missing, other plan or hidden by RLS) returns 404; a bad body returns 400. Only moving onto an **empty** slot is supported; swapping two occupied slots is a follow-up. The route does not re-check authorization: RLS scopes the update (see [[rls-authorization]]).
- **Desktop drag and drop** (`@dnd-kit/core`, in `WeekPlanDesktop`): drag a slot by its handle to an empty cell, or drag a recipe from the strip above the grid to an empty cell (adds it with 1 serving). Only empty cells are drop targets. `PointerSensor` needs 6 px of movement, so clicking the handle or a stepper button is not a drag. `DragOverlay` draws the dragged item outside the scrolling table.
- **Keyboard and touch alternative:** each filled slot has a „Przenieś" button that opens a sheet of the free positions for the week. It is the move control on mobile, which has no touch drag; mobile adding still goes through „+ dodaj posiłek" and the recipe picker. The drag handle also works with the keyboard sensor (Space lifts, arrows move, Space drops), with Polish announcements, but the sheet is the dependable path. Targets are positions 0–4 of the shown week.
- **Servings stepper** on a filled slot: − / + between 1 and 99, persisted through the same `PATCH`. `/api/shopping` already scales by `slot.servings`, so the shopping list follows.

### Unavailable recipes

`plan_slots.recipe_id` is `on delete set null`, so deleting a recipe keeps the slot and nulls the reference. The UI shows „przepis niedostępny" when `recipe_id` is set but the joined `recipe` is null. Because deletion nulls `recipe_id`, that state comes mostly from an **unavailable recipe** hidden by RLS, not a deleted one. Covers Review Focus #4; tested in `tests/unit/plan-unavailable-recipe.test.tsx`.

## Invariants and gotchas

- **A slot's date is inside its plan's week** (Monday to Sunday). `PATCH` checks it first (400 „date outside the plan week"); since migration 0013 the database enforces it too: trigger `plan_slots_date_in_week` rejects a slot insert or move outside the week, and `plans_week_keeps_slots` rejects changing a plan's `week_start_date` while that would strand its slots (both `23514`). `POST /api/plans/[id]/slots` maps that error to 400 like any other upsert error.
- **New slots start at 1 serving** (picker and drop alike); change it with the stepper.
- **Labels aren't stored.** `label` is always sent as null. Desktop derives the label from the position and mobile shows „posiłek N", so the same slot is labelled differently in the two views.
- A mobile slot at position 5 or higher doesn't appear in the desktop grid, and can't be moved to such a position (the move sheet offers 0–4).
- `new Date(plan.week_start_date)` parses `yyyy-MM-dd` as **UTC midnight**. That's fine in Poland (UTC+1/+2), but in a timezone west of UTC the columns shift back one day.
- `getOrCreatePlan` is a select followed by an insert. Two concurrent first loads can race; the loser hits the unique constraint and gets a 500.

## Known gaps

- Day totals are all-or-nothing: one non-gram or macro-less ingredient hides the whole day's total (no unit conversion, see [[macro-calculation]]).
- Swapping two occupied slots is not supported; a move onto an occupied slot fails with 409 and a message.
- `getOrCreatePlan` races on a first load (see above).
- In dark mode the recipe name in a slot card was barely readable; the slot colours now use the `on-slot` token (#37), so this is fixed.

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

- `src/lib/db/plans.ts`, `src/lib/plan-slots.ts`, `src/lib/week.ts`, `src/hooks/usePlan.ts`, `src/components/plan/*`, `src/app/(app)/plan/page.tsx`, `src/lib/schemas.ts`

## Changelog

- 2026-10-13: The slot-date-in-week rule is enforced in the database (migration 0013, #72).
- 2026-10-13: Per-day macro totals (#44).
- 2026-10-13: Week navigation by `?week=`, `PATCH` for slot moves and servings, drag and drop with a picker alternative, servings stepper; removed the `dayMacros` stub and the build-time week gap (#38).
- 2026-10-13: Layout switch moved from `matchMedia` to CSS (#37).

- 2026-10-09: Unavailable-recipe label changed from „przepis usunięty" to „przepis niedostępny" (issue #16); both views updated.
- 2026-10-09: Re-verified against a7f8f52 (no behaviour change in the plan code). Rebuilt the build-week gap from a fresh `pnpm build` (now `2026-10-05`, `/shopping` also static). Corrected the slot-name readability note (the label is grey, not the name) and the error-handling note (`assign`/`remove` don't check the status).
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Added a gap found in the 2026-10-04 smoke test.
- 2026-10-04: Created from legacy `plan.md`. Added the servings-always-1, label mismatch, UTC parsing and create-race notes, plus the build-time week freeze (seen in `pnpm build` output).
