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
pnpm wiki:check   # validate docs/wiki (frontmatter, links, markdownlint)
```
No code lint script configured (scaffolded with `--no-eslint`).

## Conventions
- Shared types in `src/lib/types.ts`; Zod schemas in `src/lib/schemas.ts`. No `any` — use `unknown` + Zod parsing at boundaries.
- Code/comments in English; UI text in Polish.
- Every function in `src/lib/` has a unit test in `tests/unit/`.
- Macros stored per 100g on ingredients, per-serving on recipes (computed, not stored).
- RLS is the authorization boundary — API routes generally trust it rather than re-implementing checks, except where explicitly noted (see `docs/wiki/concepts/rls-authorization.md` for the exceptions and loose policies).

## Environment
`.env.local` (gitignored) needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Live Supabase project ref: `tfysxpkfbumctfuxcend`. `GEMINI_API_KEY` (Gemini fallback, currently commented out). Optional: `LLM_MODE=server` (LLM runs on server via Ollama, see `docs/wiki/concepts/llm-modes.md`; all vars in `docs/wiki/references/env-vars.md`), `OLLAMA_URL`, `OLLAMA_MODEL`.

## Where to look next
- `docs/wiki/` — Obsidian vault, entry point `docs/wiki/README.md`. One page per concept (`concepts/`), task (`guides/`), lookup table (`references/`) and decision (`decisions/`). Read the relevant page before working in an area; update it in the same PR when behaviour changes. Rules: `docs/wiki/RULES.md`. Open bugs and risks: `docs/wiki/references/known-gaps.md`.
- `docs/plans/architecture_plan_document.md` — the original spec (check `docs/wiki/references/spec-drift.md` before trusting it), task-by-task, including a "Review Focus" section naming known-risky edge cases (zero servings, mixed-unit shopping list items, deleted-recipe plan slots, etc.) and which task's tests cover each.
