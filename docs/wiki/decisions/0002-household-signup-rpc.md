---
title: "0002 Household Signup via RPC"
summary: "Create the household and its owner membership in one security-definer function instead of two client inserts."
tags: [household, rls, auth]
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
  - title: "Signup RPC migration"
    path: supabase/migrations/0003_household_signup_rpc.sql
  - title: "Auth form"
    path: src/components/auth/AuthForm.tsx
---

# 0002 Household Signup via RPC

> [!tldr]
> Signup calls `create_household_with_owner(household_name)`, a `security definer` function that inserts the household and the `owner` membership together, before any RLS read-back can fail.

## Context

The plan's signup called only `auth.signUp()`, so a new user had no household and failed every `is_member_of()` check. The first fix inserted both rows from the browser, but `households.insert().select().single()` failed: `households_select` requires membership, and the membership row didn't exist yet at read-back time. See [[decisions]].

## Decision

**Status:** accepted (migration `0003_household_signup_rpc.sql`, commit `a8b8cef`).

A `security definer` plpgsql function checks `auth.uid()`, does both inserts, and returns the new id. Only the `authenticated` role can execute it.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- A trigger on `auth.users`: automatic, but it couples to Supabase's auth schema and has no household name at that point.
- Two client inserts without `.select()`: avoids the read-back, but isn't atomic.

## Consequences

- One round trip, atomic, and the RLS on `households` stays strict.
- It still needs a session. With email confirmation enabled, the RPC fails at signup and nothing retries it later (see [[household-model#Known gaps]]).

## Related

- [[decisions]]
- [[household-model]]
- [[auth-session]]

## Sources

- `supabase/migrations/0003_household_signup_rpc.sql` (header comment), `src/components/auth/AuthForm.tsx` (comment), commit `a8b8cef`

## Changelog

- 2026-10-04: Recorded retroactively.
