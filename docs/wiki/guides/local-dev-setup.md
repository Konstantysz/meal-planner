---
title: "Local Dev Setup"
summary: "Get the app running locally against the hosted Supabase project: tools, env file, first account, and the checks to run."
tags: [dev-setup]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: medium
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: dd67b66
sources:
  - title: "Package manifest"
    path: package.json
  - title: "Agent orientation"
    path: AGENTS.md
  - title: "Supabase CLI config"
    path: supabase/config.toml
---

# Local Dev Setup

> [!tldr]
> Install pnpm 9 and Node, create `.env.local` with the two `NEXT_PUBLIC_SUPABASE_*` values, then `pnpm install` and `pnpm dev`. Sign up at `/signup`: that creates your household. Before a PR, run `pnpm test`, `pnpm typecheck` and `pnpm build`.

## Context

The usual setup points the local app at the hosted Supabase project (`tfysxpkfbumctfuxcend`); there is no local database by default. See [[guides]] and [[env-vars]].

## Prerequisites

- Node.js `^22.22`, `^24.15` or `>=26`. vitest 5 and jsdom 30 require it, so the plan's "Node 20+" is out of date: on Node 20 the test runner fails to start. CI uses Node 24. `pnpm build` was verified on Node 26.
- pnpm `9.15.9` (pinned in `packageManager`; `corepack enable` picks it up). On Windows, `corepack enable` writes to `C:Program Files
odejs` and fails with `EPERM` unless the terminal runs as administrator. Without admin: `npm install -g pnpm@9.15.9`.
- Windows, Node upgrade: `winget install OpenJS.NodeJS.LTS`, then open a new terminal.
- The Supabase project URL and anon key, from the dashboard under Settings → API.

## Steps

1. Install dependencies. This also enables the repo's git hooks (`core.hooksPath = .githooks`), which check formatting (Prettier) and lint (ESLint) on staged code files and run `pnpm wiki:check` when you commit wiki changes:

   ```bash
   pnpm install
   ```

2. Create `.env.local` (gitignored) as shown in [[env-vars#Examples]]. Only the two `NEXT_PUBLIC_SUPABASE_*` variables are required.
3. Start the dev server:

   ```bash
   pnpm dev            # http://localhost:3000
   ```

4. Open `/signup` (the login page has no link to it) and create an account. A database trigger creates your household (see [[household-model]]). If the project requires email confirmation, confirm and then log in on `/login`.
5. `/` is still the Next.js starter page. Go to `/recipes`.

## Verify

```bash
pnpm lint        # ESLint (CI fails on errors, not warnings)
pnpm format      # Prettier: rewrite; CI runs format:check
pnpm test        # all green (138 tests at dd67b66)
pnpm typecheck
pnpm build       # also shows which routes are static (○) vs dynamic (ƒ)
pnpm wiki:check  # if you touched docs/wiki
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| Every page redirects to `/login` | No session. Log in, or check the env vars. |
| `fetch('/api/…')` returns HTML | Logged out. The proxy redirected to `/login` (see [[auth-session]]). |
| Recipe import fails „WebGPU" | The browser has no WebGPU. Use [[run-import-with-ollama]]. |
| `pnpm test`: „Failed to start forks worker" | Node is too old (20.x). Install Node 24. |
| `pnpm format:check` lists dozens of files you didn't touch | CRLF line endings from a checkout made before `.gitattributes` (`eol=lf`). With a clean tree: `git rm -rq --cached . && git reset -q --hard HEAD`. |
| `pnpm dev`: „Another next dev server is already running" | An old server holds port 3000. `taskkill /PID <pid> /F` (the PID is in the message). |

> [!warning] Uncertain: local Supabase stack
> `supabase/config.toml` (project_id `meal-planner-mvp`, Postgres 17, seed enabled) supports `supabase start` and `supabase db reset` for a fully local stack. The Supabase CLI isn't a project dependency and wasn't installed on the machine this was verified on, so that path is untested. See [[apply-migration]].

## Examples

```powershell
# LAN access from a phone (import then needs server mode)
$env:LLM_MODE='server'; pnpm dev -H 0.0.0.0
```

## Related

- [[guides]]
- [[env-vars]]
- [[architecture-overview]]
- [[write-unit-tests]]

## Sources

- `package.json` (scripts, `packageManager`), `AGENTS.md`, `supabase/config.toml`

## Changelog

- 2026-10-04: Node 24 install and corepack EPERM on Windows, signup via trigger, CRLF and port-in-use troubleshooting.
- 2026-10-04: Created.
