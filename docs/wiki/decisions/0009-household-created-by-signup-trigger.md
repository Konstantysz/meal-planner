---
title: "0009 Household Created by the Signup Trigger"
summary: "Every new auth user gets a household and an owner membership from the on_auth_user_created trigger, not from a client insert or an RPC call made after signUp."
tags: [household, auth, database, rls]
status: stable
owner: "@konstantysz"
created: 2026-10-09
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Signup trigger and idempotent RPC (migration 0006)"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "Signup RPC (migration 0003, superseded)"
    path: supabase/migrations/0003_household_signup_rpc.sql
  - title: "Security hardening (no household insert policy)"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Auth form (signup no longer calls the RPC)"
    path: src/components/auth/AuthForm.tsx
  - title: "Household model"
    path: docs/wiki/concepts/household-model.md
---

# 0009 Household Created by the Signup Trigger

> [!tldr]
> An `after insert` trigger on `auth.users` runs `handle_new_user()`, which creates the household and the owner membership in the same transaction as the signup. The client never inserts a household. This supersedes [[0002-household-signup-rpc]].

## Context

[[0002-household-signup-rpc]] called `create_household_with_owner` after `signUp()`. With email confirmation on, `signUp()` returns no session, the RPC raised "not authenticated", and the new user was left without a household, so every `is_member_of()` check failed. The trigger does not depend on the session. See [[decisions]].

## Decision

**Status:** accepted (migration 0006, commit `dd67b66`).

- `on_auth_user_created` runs `handle_new_user()` for every insert on `auth.users`. The function is `security definer` with `search_path = public`.
- It inserts a `households` row named after the email's local part (fallback „Moje gospodarstwo") and an `owner` row in `household_members`.
- Execute is revoked from `public`, `anon` and `authenticated`, so only the trigger calls it.
- Migration 0006 backfills users who have no membership row.
- `create_household_with_owner` stays, made idempotent: it returns the caller's existing owned household. Nothing in the app calls it.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- Keep the client-side RPC after `signUp()`: fails whenever no session exists yet, which is the email-confirmation case.
- Let the client insert the household and membership: 0002 already tried this, and the read-back failed under RLS.

## Consequences

- Household creation works whatever the client does, and before email confirmation.
- Every auth user gets a household row at signup, including users who never confirm their email.
- Never insert a household from the client. Migration 0004 dropped `households_insert` and did not recreate it, so only security-definer functions create households.
- The household name is the email's local part, a placeholder the user did not choose.

## Related

- [[decisions]]
- [[0002-household-signup-rpc]]
- [[household-model]]
- [[rls-authorization]]
- [[0001-rls-is-the-authz-boundary]]

## Sources

- `supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql` (trigger, backfill, idempotent RPC; header comment gives the email-confirmation failure)
- `supabase/migrations/0003_household_signup_rpc.sql`, `supabase/migrations/0004_security_hardening.sql`
- `src/components/auth/AuthForm.tsx`
- Commit `dd67b66` (migration 0006), commit `a8b8cef` (the RPC of 0002)

## Changelog

- 2026-10-09: Recorded retroactively from migration 0006 and commit `dd67b66`.
