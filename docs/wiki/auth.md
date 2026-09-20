# Auth

Supabase Auth via `@supabase/ssr`. Clients: `src/lib/supabase/client.ts` (browser), `server.ts` (server components/routes), `middleware.ts` (session refresh + redirects).

Protected routes: everything except `/login`, `/signup`, `/share/*`, `/manifest.json` redirects to `/login` when unauthenticated. Authenticated users hitting `/login`/`/signup` redirect to `/recipes`.

## Household bootstrap on signup
`AuthForm.tsx` (signup mode) does more than `supabase.auth.signUp()`: it also inserts a `households` row and a `household_members` (role 'owner') row for the new user, using the browser client right after signup. This is NOT in the original plan's given code — it was added because without it, a new user can never pass `is_member_of()` on their own household (see [database.md](database.md)).

**Edge case**: if Supabase requires email confirmation, `signUp()` returns a user but no active session, so the household/membership inserts fail RLS (no `auth.uid()` yet). The form surfaces this as an error rather than a false success — but there's no automatic household creation after the user later confirms and logs in. If email confirmation is enabled, a first-login flow needs to check for and create a missing household.

## Household invites
`inviteMember(supabase, householdId, userId, callerId)` in `src/lib/db/households.ts` takes an already-resolved user UUID, not an email — there's no email→user lookup wired up (would need a service-role admin client, not set up in this codebase). The settings page discloses this limitation to users. `/api/household/invite` explicitly checks the caller is a member via `.eq('user_id', callerId)`, not relying on RLS alone.
