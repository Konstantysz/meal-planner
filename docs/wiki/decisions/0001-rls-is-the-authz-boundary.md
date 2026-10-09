---
title: "0001 RLS Is the Authorization Boundary"
summary: "Authorization is enforced by Postgres RLS keyed on household membership, not by checks in route handlers."
tags: [rls, security, architecture]
status: stable
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
  - title: "Architecture plan (Global Constraints)"
    path: docs/plans/architecture_plan_document.md
  - title: "Initial RLS"
    path: supabase/migrations/0001_initial.sql
  - title: "Security hardening (RLS tightened)"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Agent orientation"
    path: AGENTS.md
---

# 0001 RLS Is the Authorization Boundary

> [!tldr]
> Every table with user data has RLS on. Route handlers use the user's own session and trust the database to filter. The only application-level membership check is in `inviteMember`; other routes scope by the caller's first `household_members` row and rely on RLS. Routes return 401 without a session, which is authentication, not authorization.

## Context

The app is a single Next.js deployment talking to Supabase with the public anon key plus the user's session cookie. The browser can call Supabase REST directly, so checks in route handlers alone would protect nothing. See [[decisions]].

## Decision

**Status:** accepted (original spec, Global Constraints: "Supabase RLS włączone na każdej tabeli z danymi użytkownika", RLS on for every table with user data).

- Enable RLS on every table and grant access through `is_member_of(household_id)` (`security definer`).
- Route handlers use `createServerSupabase()` (cookie-bound) and never the service-role key.
- Add an application check only where RLS can't express the rule or a mistake would be costly. In code that is one place: `inviteMember` checks caller membership explicitly (commit `64e3275`). Its check is redundant with RLS since migration 0004.

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

- Original spec, `docs/plans/architecture_plan_document.md` (Global Constraints), `supabase/migrations/0001_initial.sql`, `AGENTS.md`

## Changelog

- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-09: Re-verified against a7f8f52. Corrected the "only explicit check" wording (authentication 401s are not authorization checks); added migration 0004 as a source.
- 2026-10-04: Recorded retroactively from the plan and code.
