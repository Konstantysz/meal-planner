# Week plan

DB helpers in `src/lib/db/plans.ts` (`getOrCreatePlan`, `getWeekPlan`, `upsertSlot`, `deleteSlot`). UI: `src/components/plan/` (`WeekPlan` picks desktop-grid vs mobile-list by viewport width), hook `src/hooks/usePlan.ts`.

## Known stub: per-day macro totals are not computed
`WeekPlan.tsx`'s `dayMacros` is a stub — it never fetches per-slot recipe ingredient data, so `DayMacroSummary` always renders "brak danych makro" on mobile even when slots have real recipes assigned. This is intentional per the plan (comment says "fetch per-slot async in a future iteration") — not a bug, but a real gap if daily macro totals are expected to work.

## "przepis usunięty" label
Desktop/mobile views show "przepis usunięty" (recipe deleted) when `slot.recipe_id` is set but the joined `recipe` comes back null. Given the `on delete set null` FK (see [database.md](database.md)), this state is reached less often via actual deletion (which nulls `recipe_id` too) and more likely via an RLS-hidden recipe (visibility changed, household membership changed) — the label is slightly misleading but the branch is genuinely reachable, not dead code.
