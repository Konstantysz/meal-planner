<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Meal planner

PWA for meal planning: recipe database, URL import (jadłonomia, aniagotuje), week plan, shopping list. Built from `docs/plans/architecture_plan_document.md`, a historical spec: check `docs/wiki/references/spec-drift.md` before trusting it.

## Stack
Next.js 16 (App Router; middleware is `src/proxy.ts`) + TypeScript + Tailwind + Supabase (Postgres + Auth + RLS). Vitest + React Testing Library. Zod for all validation. `cheerio`/`turndown` for HTML→Markdown import pipeline, `@mlc-ai/web-llm` (browser) or Ollama (server, `LLM_MODE=server`) for recipe extraction; the Gemini fallback is paused. `idb` for offline shopping-list storage. `@dnd-kit` for drag-and-drop (planned, not yet used).

## Commands
```
pnpm dev          # localhost:3000
pnpm test         # vitest run
pnpm typecheck    # tsc --noEmit
pnpm build        # production build
pnpm lint         # ESLint (flat config, eslint-config-next)
pnpm format       # Prettier write (CI runs format:check)
pnpm wiki:check   # validate docs/wiki (frontmatter, links, avoided terms, markdownlint)
pnpm wiki:stale   # wiki pages whose sources changed since verified_commit
```
CI (`.github/workflows/ci.yml`) runs lint, format:check, typecheck, test, wiki:check and build on every PR. The pre-commit hook checks staged files the same way.

## Conventions
- Shared types in `src/lib/types.ts`; Zod schemas in `src/lib/schemas.ts`. No `any` — use `unknown` + Zod parsing at boundaries.
- Code, comments and all documentation (README, AGENTS.md, wiki, commit messages, PR descriptions and comments) in English; UI text in Polish.
- Most exported functions in `src/lib/` have a unit test in `tests/unit/`. The uncovered ones are listed in `docs/wiki/references/test-coverage.md` (Not covered); new functions need a test.
- Macros stored per 100g on ingredients, per-serving on recipes (computed, not stored).
- RLS is the authorization boundary — API routes generally trust it rather than re-implementing checks, except where explicitly noted (see `docs/wiki/concepts/rls-authorization.md` for the exceptions and loose policies).
- Writes that span tables go through RPCs, not client-side insert chains: recipes via `save_recipe` (`createRecipe`), households via the `on_auth_user_created` trigger (never insert a household from the client). Public share links only via `get_shared_plan` (`getSharedPlan`); never add `anon` select policies for sharing.
- Plans start on Monday (DB check `plans_week_start_monday`). Compute weeks with `weekStartOf` / `normalizeWeekStart` from `src/lib/week.ts`, not `toISOString()`.

## Database changes
- **Merging into `main` deploys new files in `supabase/migrations/` to production** (Supabase GitHub integration, "Deploy to production"; Free plan, no preview branch). There is no staging database.
- A migration PR ships `supabase/migrations/000N_<name>.sql` plus a manual rollback in `supabase/rollbacks/` and a verification script in `supabase/checks/` (not `supabase/tests/`, which `supabase test db` runs as pgTAP). A human runs the script in the SQL editor before merging (baseline) and after the deploy (`ALL PASS`). Agents don't write to the live database. Full flow: `docs/wiki/guides/apply-migration.md`.
- `.mcp.json` configures the Supabase MCP server for the live project, `read_only=true`: fine for inspecting schema, data and advisors.
- What changed and why, migration by migration: `docs/wiki/references/migration-history.md`.

## Parallel agents
Subagents editing code at the same time each get `isolation: "worktree"`, one per issue or PR. Base each worktree on the integration branch and run `pnpm install --frozen-lockfile` first. Removing one on Windows can fail with "Filename too long": see `docs/wiki/guides/local-dev-setup.md`.

## Environment
Node 24 (CI pins 24; vitest 5 and jsdom 30 declare engines that exclude Node 20), pnpm 9.15.9 via corepack. Live Supabase project ref: `tfysxpkfbumctfuxcend`. `SUPABASE_SERVICE_ROLE_KEY` is only for `scripts/backfill-ingredient-macros.ts`; the app never reads it. Gemini fallback is paused.
Before adding or changing an env var: `docs/wiki/references/env-vars.md`. Setup and Windows gotchas: `docs/wiki/guides/local-dev-setup.md`.

## Where to look next
- Before changing `supabase/migrations/`, RLS or an RPC: `docs/wiki/references/migration-history.md`.
- Before changing an area: read its page in `docs/wiki/` (entry `docs/wiki/README.md`, concepts in `concepts/concepts.md`) and update it in the same PR. Rules: `docs/wiki/RULES.md`. Open bugs and risks: `docs/wiki/references/known-gaps.md`.
- Before naming a domain concept: `GLOSSARY.md`. Why-decisions (ADRs): `docs/wiki/decisions/`.
- Edge cases (zero servings, mixed-unit shopping items, deleted-recipe slots): the "Review Focus" section of `docs/plans/architecture_plan_document.md` names them and the tests covering each.
