---
title: "Household Model"
summary: "Households own all recipes and plans; how a household is bootstrapped at signup via RPC, how membership is resolved per request, and how invites work."
tags: [household, auth, rls]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 19a988a
sources:
  - title: "Signup RPC migration"
    path: supabase/migrations/0003_household_signup_rpc.sql
  - title: "Security hardening"
    path: supabase/migrations/0004_security_hardening.sql
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
> Every recipe and plan belongs to a **household**, and users reach data only through `household_members`. Signup creates the household and the owner membership in one `security definer` RPC. Routes act on the caller's *first* membership row. Invites need a user's UUID; there is no email lookup.

## Context

[[rls-authorization]] grants access through `is_member_of(household_id)`. A user without a membership row can do almost nothing, so bootstrapping the household correctly is load-bearing. See [[concepts]] and the [[glossary]].

## How it works

### Bootstrap on signup

`AuthForm` (signup mode) calls `supabase.auth.signUp()`. If that returns a user, it calls:

```ts
await supabase.rpc('create_household_with_owner', { household_name: email.split('@')[0] || 'Moje gospodarstwo' });
```

The function (migration 0003) checks `auth.uid()`, inserts into `households`, then inserts an `owner` row into `household_members`, all in one statement.

Why an RPC? The earlier client-side version did `households.insert().select().single()`. The `.select()` read-back failed `households_select` (`is_member_of(id)`), because the membership row didn't exist yet. Commit `a8b8cef` replaced it with the RPC.

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

- Never insert a household from the client and then read it back. Use the RPC, or anything else that creates the membership first.
- Since migration 0004, `hm_insert` allows only `is_member_of(household_id) and role = 'member'`. Only an existing member can add someone, never as `owner`, and nobody can add themselves to a foreign household. The owner row comes only from `create_household_with_owner`. `inviteMember`'s explicit check is now redundant with RLS, but harmless.
- `hm_delete` (0004): a member may remove themselves; the owner may remove anyone else; the owner can't remove themselves.
- Multiple households per user are possible in the schema but unsupported in the app, because of the `limit(1)` resolution.

## Known gaps

- **Email confirmation:** if confirmations are enabled on the hosted project, `signUp` returns a user but no session, so the RPC raises `not authenticated`. The form shows the error, but nothing creates the household on first login.
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

## Sources

- `supabase/migrations/0003_household_signup_rpc.sql`, `src/components/auth/AuthForm.tsx`
- `src/lib/db/households.ts`, `src/app/api/household/invite/route.ts`, `src/app/(app)/settings/page.tsx`
- Commits `a8b8cef` (RPC) and `64e3275` (explicit caller check)

## Changelog

- 2026-10-04: Updated the membership rules for migration 0004 (self-join fixed, `hm_delete` rules).
- 2026-10-04: Created from legacy `auth.md`. Fixed the stale claim that signup inserts the rows client-side (it uses the RPC since `a8b8cef`). Added the self-join RLS gap.
