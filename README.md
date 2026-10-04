# Meal planner

PWA for meal planning: recipe database, URL import (jadłonomia, aniagotuje), week plan and shopping list (works offline). UI is in Polish.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, RLS) · Vitest · Zod. Recipe extraction runs in the browser (`@mlc-ai/web-llm`) or on the server via Ollama (`LLM_MODE=server`).

## Quick start

Requires Node 24 (vitest 5 / jsdom 30 don't start on Node 20) and pnpm 9.15.9 via corepack.

```bash
corepack enable
pnpm install
# create .env.local (see below)
pnpm dev                           # http://localhost:3000
```

`.env.local` (gitignored) needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. All variables: [`docs/wiki/references/env-vars.md`](docs/wiki/references/env-vars.md). Windows gotchas and `.mcp.json` (Supabase MCP, read-only): [`docs/wiki/guides/local-dev-setup.md`](docs/wiki/guides/local-dev-setup.md).

## Commands

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `pnpm dev`         | Dev server on localhost:3000                  |
| `pnpm build`       | Production build                              |
| `pnpm test`        | Vitest                                        |
| `pnpm typecheck`   | `tsc --noEmit`                                |
| `pnpm lint`        | ESLint                                        |
| `pnpm format`      | Prettier write (CI runs `format:check`)       |
| `pnpm wiki:check`  | Validate `docs/wiki` (frontmatter, links)     |

CI runs lint, wiki check, test and build on every PR; the pre-commit hook checks staged files.

## Database changes

> [!IMPORTANT]
> **Merging into `main` deploys new files in `supabase/migrations/` to production** (Supabase GitHub integration, "Deploy to production"). There is no staging database.

A migration PR ships the migration, a manual rollback in `supabase/rollbacks/` and a verification script in `supabase/checks/`, which a human runs in the SQL editor before merging and after the deploy. Full flow: [`apply-migration.md`](docs/wiki/guides/apply-migration.md).

- [`migration-history.md`](docs/wiki/references/migration-history.md): what changed and why, migration by migration. Start here.
- [`database-schema.md`](docs/wiki/references/database-schema.md): current tables, policies and functions.
- [`known-gaps.md`](docs/wiki/references/known-gaps.md): open bugs and risks.

## Docs

[`docs/wiki/`](docs/wiki/README.md) is an Obsidian vault with one page per concept, guide, reference and decision. Contributor and agent conventions: [`AGENTS.md`](AGENTS.md).
