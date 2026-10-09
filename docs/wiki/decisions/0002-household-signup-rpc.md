---
title: "0002 Household Signup via RPC"
summary: "Create the household and its owner membership in one security-definer function instead of two client inserts."
tags: [household, rls, auth]
status: deprecated
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Signup RPC migration"
    path: supabase/migrations/0003_household_signup_rpc.sql
  - title: "Signup trigger (replacement)"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "Auth form"
    path: src/components/auth/AuthForm.tsx
---

# 0002 Household Signup via RPC

> [!tldr]
> **Superseded.** Migration 0003 made signup call `create_household_with_owner(household_name)` after `signUp()`. Since migration 0006 the `on_auth_user_created` trigger creates the household and owner membership for every new user, and the app no longer calls the RPC. See [[household-model]].

## Context

The plan's signup called only `auth.signUp()`, so a new user had no household and failed every `is_member_of()` check. The first fix inserted both rows from the browser, but `households.insert().select().single()` failed: `households_select` requires membership, and the membership row didn't exist yet at read-back time. See [[decisions]].

## Decision

**Status:** superseded by the signup trigger `on_auth_user_created` (`handle_new_user()`, migration `0006_atomic_recipe_and_signup_trigger.sql`). See [[household-model]]. Originally accepted (migration `0003_household_signup_rpc.sql`, commit `a8b8cef`).

Original decision, kept for history: a `security definer` plpgsql function checks `auth.uid()`, does both inserts, and returns the new id. Only the `authenticated` role can execute it. Migration 0006 keeps the function, now idempotent, but nothing in the app calls it.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- A trigger on `auth.users`: automatic and independent of the session. Not chosen in 0003; migration 0006 adopted it.
- Two client inserts without `.select()`: avoids the read-back, but isn't atomic.

## Consequences

- One round trip, atomic, and the RLS on `households` stays strict.
- Historical: it needed a session. With email confirmation enabled, the RPC failed at signup and nothing retried it. Migration 0006 fixed this by moving creation into the trigger.

## Related

- [[decisions]]
- [[household-model]]
- [[auth-session]]
- [[0009-household-created-by-signup-trigger]]

## Sources

- `supabase/migrations/0003_household_signup_rpc.sql` (header comment), `supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql` (trigger and idempotent RPC), `src/components/auth/AuthForm.tsx` (comment), commit `a8b8cef`

## Changelog

- 2026-10-09: Re-verified against a7f8f52. Marked superseded by the 0006 signup trigger; kept the original decision as history. Status set to `deprecated`.
- 2026-10-04: Recorded retroactively.
