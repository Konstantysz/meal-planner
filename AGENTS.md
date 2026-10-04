<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Meal planner

PWA for meal planning: recipe database, URL import (jadłonomia, aniagotuje), week plan, shopping list. Built from `docs/plans/architecture_plan_document.md` via subagent-driven-development — see that file for full task-by-task spec.

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
pnpm wiki:check   # validate docs/wiki (frontmatter, links, markdownlint)
```
CI (`.github/workflows/ci.yml`) runs lint, format:check, typecheck and test on every PR. The pre-commit hook checks staged files the same way.

## Conventions
- Shared types in `src/lib/types.ts`; Zod schemas in `src/lib/schemas.ts`. No `any` — use `unknown` + Zod parsing at boundaries.
- Code, comments and all documentation (README, AGENTS.md, wiki, commit messages, PR descriptions and comments) in English; UI text in Polish.
- Every function in `src/lib/` has a unit test in `tests/unit/`.
- Macros stored per 100g on ingredients, per-serving on recipes (computed, not stored).
- RLS is the authorization boundary — API routes generally trust it rather than re-implementing checks, except where explicitly noted (see `docs/wiki/concepts/rls-authorization.md` for the exceptions and loose policies).
- Writes that span tables go through RPCs, not client-side insert chains: recipes via `save_recipe` (`createRecipe`), households via the `on_auth_user_created` trigger (never insert a household from the client). Public share links only via `get_shared_plan` (`getSharedPlan`); never add `anon` select policies for sharing.
- Plans start on Monday (DB check `plans_week_start_monday`). Compute weeks with `weekStartOf` / `normalizeWeekStart` from `src/lib/week.ts`, not `toISOString()`.

## Database changes
- **Merging into `main` deploys new files in `supabase/migrations/` to production** (Supabase GitHub integration, "Deploy to production"; Free plan, no preview branch). There is no staging database.
- A migration PR ships `supabase/migrations/000N_<name>.sql` plus a manual rollback in `supabase/rollbacks/` and a verification script in `supabase/checks/` (not `supabase/tests/`, which `supabase test db` runs as pgTAP). A human runs the script in the SQL editor before merging (baseline) and after the deploy (`ALL PASS`). Agents don't write to the live database. Full flow: `docs/wiki/guides/apply-migration.md`.
- `.mcp.json` configures the Supabase MCP server for the live project, `read_only=true`: fine for inspecting schema, data and advisors.
- What changed and why, migration by migration: `docs/wiki/references/migration-history.md`.

## Environment
Node 24 (vitest 5 / jsdom 30 don't start on Node 20; CI uses 24), pnpm 9.15.9 via corepack. `.env.local` (gitignored) needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `SUPABASE_SERVICE_ROLE_KEY` only for `scripts/backfill-ingredient-macros.ts`. Live Supabase project ref: `tfysxpkfbumctfuxcend`. `GEMINI_API_KEY` (Gemini fallback, currently commented out). Optional: `LLM_MODE=server` (LLM runs on server via Ollama, see `docs/wiki/concepts/llm-modes.md`; all vars in `docs/wiki/references/env-vars.md`), `OLLAMA_URL`, `OLLAMA_MODEL`. Setup and Windows gotchas: `docs/wiki/guides/local-dev-setup.md`.

## Where to look next
- `docs/wiki/references/migration-history.md` — start here if you missed the 2026-10-04 database audit (migrations 0004–0006).
- `docs/wiki/` — Obsidian vault, entry point `docs/wiki/README.md`. One page per concept (`concepts/`), task (`guides/`), lookup table (`references/`) and decision (`decisions/`). Read the relevant page before working in an area; update it in the same PR when behaviour changes. Rules: `docs/wiki/RULES.md`. Open bugs and risks: `docs/wiki/references/known-gaps.md`.
- `docs/plans/architecture_plan_document.md` — the original spec (check `docs/wiki/references/spec-drift.md` before trusting it), task-by-task, including a "Review Focus" section naming known-risky edge cases (zero servings, mixed-unit shopping list items, deleted-recipe plan slots, etc.) and which task's tests cover each.
