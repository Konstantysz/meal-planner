---
title: "Household Model"
summary: "Households own all recipes and plans; how a household is bootstrapped at signup by a database trigger, how membership is resolved per request, and how invites work."
tags: [household, auth, rls]
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
  - title: "Signup RPC migration"
    path: supabase/migrations/0003_household_signup_rpc.sql
  - title: "Security hardening"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Signup trigger"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "Auth form (signup)"
    path: src/components/auth/AuthForm.tsx
  - title: "inviteMember"
    path: src/lib/db/households.ts
  - title: "Invite route"
    path: src/app/api/household/invite/route.ts
  - title: "Settings page"
    path: src/app/(app)/settings/page.tsx
---

# Household Model

> [!tldr]
> Every recipe and plan belongs to a **household**, and users reach data only through `household_members`. A trigger on `auth.users` (migration 0006) creates the household and the owner membership for every new user, in the database, even before the email is confirmed. Routes act on the caller's *first* membership row. Invites need a user's UUID; there is no email lookup.

## Context

[[rls-authorization]] grants access through `is_member_of(household_id)`. A user without a membership row can do almost nothing, so bootstrapping the household correctly is load-bearing. See [[concepts]] and the [[glossary]].

## How it works

### Bootstrap on signup

`AuthForm` (signup mode) only calls `supabase.auth.signUp()`. The database does the rest: the trigger `on_auth_user_created` runs `handle_new_user()` (`security definer`), which inserts a household named after the email's local part (fallback „Moje gospodarstwo") and an `owner` row in `household_members`. If `signUp` returns no session (email confirmation on), the form shows „Sprawdź skrzynkę…" instead of redirecting; the household already exists.

History:

1. Client-side `households.insert().select().single()`: the read-back failed `households_select` (`is_member_of(id)`), because the membership row didn't exist yet.
2. RPC `create_household_with_owner` (migration 0003, commit `a8b8cef`) called right after `signUp`: needs a session, so it failed with email confirmation on and the user was left without a household.
3. Trigger (migration 0006). `create_household_with_owner` still exists for compatibility. It is now idempotent: it returns the caller's existing owned household instead of creating a second one. Nothing in the app calls it.

### Resolving the household per request

`POST /api/recipes`, `GET /api/plans` and `GET /api/shopping` all do the same thing:

```ts
supabase.from('household_members').select('household_id').eq('user_id', user.id).limit(1).single()
```

There is no ordering and no "current household" concept.

### Invites

`inviteMember(supabase, householdId, userId, callerId)`:

1. Explicitly checks that the caller is a member (`.eq('user_id', callerId)`). This is the one place that doesn't rely on RLS alone (commit `64e3275`).
2. Inserts the invitee as `member`.

`POST /api/household/invite` takes `{ household_id, user_id }`. The settings page has **no invite UI**. It only explains („Zapraszanie po e-mailu nie jest jeszcze wspierane…").

## Invariants and gotchas

- Never insert a household from the client. The trigger creates it; `households` has no insert policy since 0004.
- Since migration 0004, `hm_insert` allows only `is_member_of(household_id) and role = 'member'`. Only an existing member can add someone, never as `owner`, and nobody can add themselves to a foreign household. The owner row is created by the signup trigger `handle_new_user()` or by `create_household_with_owner`; both are `security definer` and bypass RLS. `inviteMember`'s explicit check is now redundant with RLS, but harmless.
- `hm_delete` (0004): a member may remove themselves; the owner may remove anyone else; the owner can't remove themselves.
- Multiple households per user are possible in the schema but unsupported in the app, because of the `limit(1)` resolution.

## Known gaps

- **No email-to-user lookup.** It would need a service-role admin client (`auth.admin`), which the app doesn't have. A `ponytail:` comment in `households.ts` names that upgrade path.
- No UI to list or remove members, and no UI to leave a household (RLS allows both since 0004).

## Examples

```bash
# Invite an existing user by UUID (no UI for this yet)
curl -X POST http://localhost:3000/api/household/invite \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"household_id":"<hid>","user_id":"<uuid>"}'
```

## Related

- [[concepts]]
- [[rls-authorization]]
- [[auth-session]]
- [[database-schema]]
- [[0002-household-signup-rpc]]
- [[0009-household-created-by-signup-trigger]]

## Sources

- `supabase/migrations/0003_household_signup_rpc.sql`, `0006_atomic_recipe_and_signup_trigger.sql`, `src/components/auth/AuthForm.tsx`
- `src/lib/db/households.ts`, `src/app/api/household/invite/route.ts`, `src/app/(app)/settings/page.tsx`
- Commits `a8b8cef` (RPC) and `64e3275` (explicit caller check)

## Changelog

- 2026-10-09: Linked the trigger decision, [[0009-household-created-by-signup-trigger]].
- 2026-10-09: Re-verified against a7f8f52. Owner-row source now names the signup trigger as well as `create_household_with_owner`; confirmed no app code calls the RPC.
- 2026-10-04: Signup now relies on the `on_auth_user_created` trigger (0006); removed the email-confirmation gap.
- 2026-10-04: Updated the membership rules for migration 0004 (self-join fixed, `hm_delete` rules).
- 2026-10-04: Created from legacy `auth.md`. Fixed the stale claim that signup inserts the rows client-side (it uses the RPC since `a8b8cef`). Added the self-join RLS gap.
