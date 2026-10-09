---
title: "Local Dev Setup"
summary: "Get the app running locally against the hosted Supabase project: tools, env file, first account, and the checks to run."
tags: [dev-setup]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: medium
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
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

- Node.js 24 (CI pins 24 in every job). `package.json` has no `engines` field and there is no `.nvmrc`. The test stack sets the floor: jsdom 30 declares `^22.22.2 || ^24.15.0 || >=26.0.0` and vitest 5 `^22.12.0 || ^24.0.0 || >=26.0.0`, so Node 20 is out of range and the plan's "Node 20+" is out of date. Node 22.23.2 also ran the suite green (25 files, 148 tests) when checked at a7f8f52.
- pnpm `9.15.9` (pinned in `packageManager`; `corepack enable` picks it up). On Windows, `corepack enable` writes to `C:\Program Files\nodejs` and fails with `EPERM` unless the terminal runs as administrator. Without admin: `npm install -g pnpm@9.15.9`.
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
pnpm test        # all green (148 tests in 25 files at a7f8f52, Node 22.23.2)
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
| `pnpm test`: „Failed to start forks worker" | Node is too old (20.x, outside the jsdom 30 / vitest 5 engine ranges). Install Node 24. |
| `pnpm format:check` lists dozens of files you didn't touch | CRLF line endings from a checkout made before `.gitattributes` (`eol=lf`). With a clean tree: `git rm -rq --cached . && git reset -q --hard HEAD`. |
| `pnpm dev`: „Another next dev server is already running" | An old server holds port 3000. `taskkill /PID <pid> /F` (the PID is in the message). |

> [!warning] Uncertain: local Supabase stack
> `supabase/config.toml` (project_id `meal-planner-mvp`, Postgres 17, seed enabled) supports `supabase start` and `supabase db reset` for a fully local stack. The Supabase CLI isn't a project dependency and wasn't installed on the machine this was verified on, so that path is untested. See [[apply-migration]].
>
> [!warning] Uncertain: machine-specific steps and remedies
> Not checkable from the repo: the `winget install OpenJS.NodeJS.LTS` and `npm install -g pnpm@9.15.9` steps, the corepack `EPERM` message, the Supabase dashboard path (Settings → API), the „Another next dev server is already running" text (not found in `node_modules/next`), and the `git rm -rq --cached` remedy. That remedy was not run, and its `git reset --hard` discards uncommitted changes.

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

- 2026-10-09: Checked at a7f8f52: Node 24 CI pin, jsdom/vitest engine ranges, pnpm pin, scripts, hooks, Postgres 17 and seed in `config.toml`, `/signup`, `/recipes`, the `pnpm build` route markers and the test run (148 tests, 25 files, Node 22.23.2). Updated the test count. Left `verified_commit` at dd67b66 because the machine-specific steps are uncertain.
- 2026-10-09: Node prerequisite restated from the CI pin and the jsdom/vitest engine ranges; Node 22.23.2 test run noted.
- 2026-10-04: Node 24 install and corepack EPERM on Windows, signup via trigger, CRLF and port-in-use troubleshooting.
- 2026-10-04: Created.
