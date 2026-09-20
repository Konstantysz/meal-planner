# Sharing

Read-only share links: `generateShareToken()` (32-char URL-safe) in `src/lib/share-token.ts`, `createShareToken` (retry-on-collision) in `src/lib/db/households.ts`. `/share/[token]` is a public page (no auth) rendering a plan read-only via `maybeSingle()` + `notFound()`. `/api/share/[token]` mirrors the same lookup (also `maybeSingle()` + 404 guard).

RLS: anonymous visitors have no `auth.uid()`, so the member-only `plans_all` / `plan_slots_all` policies never match for them. Migration `0002_share_token_rls.sql` adds narrow, additive `for select` policies on `plans`, `plan_slots`, and `recipes` that permit a row through when it's reachable from a valid `share_tokens` row for that plan (via `plan_id`, or via `plan_slots.recipe_id` for recipes). These are select-only — mutations still require household membership through the existing `plans_all` / `plan_slots_all` policies.

Household invites: see [auth.md](auth.md) — email-based invites are not implemented; `inviteMember` requires a resolved user UUID.
