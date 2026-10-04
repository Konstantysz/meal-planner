---
title: "0001 RLS Is the Authorization Boundary"
summary: "Authorization is enforced by Postgres RLS keyed on household membership, not by checks in route handlers."
tags: [rls, security, architecture]
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
  - title: "Architecture plan (Global Constraints)"
    path: docs/plans/architecture_plan_document.md
  - title: "Initial RLS"
    path: supabase/migrations/0001_initial.sql
  - title: "Agent orientation"
    path: AGENTS.md
---

# 0001 RLS Is the Authorization Boundary

> [!tldr]
> Every table with user data has RLS on. Route handlers use the user's own session and trust the database to filter. The only explicit application-level check is in `inviteMember`.

## Context

The app is a single Next.js deployment talking to Supabase with the public anon key plus the user's session cookie. The browser can call Supabase REST directly, so checks in route handlers alone would protect nothing. See [[decisions]].

## Decision

**Status:** accepted (plan, Global Constraints: "Supabase RLS włączone na każdej tabeli z danymi użytkownika", RLS on for every table with user data).

- Enable RLS on every table and grant access through `is_member_of(household_id)` (`security definer`).
- Route handlers use `createServerSupabase()` (cookie-bound) and never the service-role key.
- Add an application check only where RLS can't express the rule or a mistake would be costly. So far that's one place: `inviteMember` checks caller membership explicitly (commit `64e3275`).

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- Checks in route handlers using a service-role client: one place to read the rules, but anyone calling Supabase REST directly with the anon key would bypass them.

## Consequences

- Routes stay thin, and the policies are the security review surface (see [[rls-authorization]]).
- Writes filtered by RLS fail silently (0 rows affected). The UI has to check the result, which it currently doesn't.
- Loose policies are real vulnerabilities. Several are listed in [[rls-authorization#Known gaps]].

## Related

- [[decisions]]
- [[rls-authorization]]
- [[household-model]]

## Sources

- `docs/plans/architecture_plan_document.md` (Global Constraints), `supabase/migrations/0001_initial.sql`, `AGENTS.md`

## Changelog

- 2026-10-04: Recorded retroactively from the plan and code.
