# Coding standards

Read during review (`.claude/agents/code-reviewer.md`). Mechanical rules live in ESLint, Prettier, `pnpm wiki:check`, `pnpm db:order` and `pnpm db:verify`; this file holds the judgement calls.

- **ADRs bind.** A diff that contradicts an accepted ADR ships a superseding ADR in the same PR. Index: `docs/wiki/decisions/decisions.md`.

## Migrations and RLS

Merging into `main` deploys a migration to production; the human runs its verification script on the live project before and after. Review as if no second chance exists.

- **Every attack has a check.** The verification script plays each access path the migration closes as `anon` or `authenticated` (denied), and each legit path the app uses (still allowed). A policy, grant or constraint without a check is a finding. Attacks undo themselves with `VRFY1`; the script ends with `raise exception 'VERIFY NNNN: …'`.
- **Baseline is stated and honest.** The header says which checks fail before the migration. A check that cannot fail before it (one that passes for the wrong reason, e.g. an error from a missing table counted as "blocked") is a finding.
- **Rollback restores the previous state**, not just something that runs: the previous policies verbatim, dropped objects recreated, and a header saying what data it loses and which app code to roll back first.
- **Policies are complete.** `to authenticated`; `(select auth.uid())`; `using` and `with check` agree unless the difference is intended and commented; a new table enables RLS with its policies in the same file; `security definer` functions pin `search_path` and revoke `execute` from `public, anon`.
- **The app still works.** Every client write the migration affects (`src/lib/db/**`, `src/app/api/**`, RPC callers) still satisfies the new policies and constraints.
- **Deploy order.** The PR body names any open migration PR that must merge first.
- **Docs ship with it.** The types and wiki pages that the "Apply a Database Migration" guide (`docs/wiki/guides/apply-migration.md`, the last of its Steps) says to update are updated in the same PR.
