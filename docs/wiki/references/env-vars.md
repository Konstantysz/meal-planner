---
title: "Environment Variables"
summary: "Every environment variable and GitHub secret the app, scripts and workflows read, where each is read and what happens when it is missing."
tags: [dev-setup, ci]
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
  - title: "Browser Supabase client"
    path: src/lib/supabase/client.ts
  - title: "Server Supabase client"
    path: src/lib/supabase/server.ts
  - title: "Extract route (LLM_MODE)"
    path: src/app/api/import/extract/route.ts
  - title: "Ollama client"
    path: src/lib/import/ollama.ts
  - title: "Gemini client"
    path: src/lib/import/gemini.ts
  - title: "Macro backfill script"
    path: scripts/backfill-ingredient-macros.ts
  - title: "LLM benchmark"
    path: scripts/bench-llm.ts
  - title: "Backup workflow"
    path: .github/workflows/backup.yml
  - title: "Keepalive workflow"
    path: .github/workflows/keepalive.yml
---

# Environment Variables

> [!tldr]
> The app needs only the two `NEXT_PUBLIC_SUPABASE_*` variables. `LLM_MODE`, `OLLAMA_URL` and `OLLAMA_MODEL` switch import to the server-side LLM. The service-role key is used only by a one-off script. Local values go in `.env.local`, which is gitignored.

## Context

This page lists every variable the code, scripts and workflows read. See [[references]].

## App and scripts

| Variable | Read in | Required | Effect / default |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/{client,server,middleware}.ts`, backfill script | yes | Supabase project URL. It is inlined into the browser bundle. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/{client,server,middleware}.ts` | yes | Public anon key. RLS is what protects data, not this key. |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/backfill-ingredient-macros.ts` only | for that script | Bypasses RLS. The app itself never reads it. |
| `LLM_MODE` | `src/app/api/import/extract/route.ts` | no | `server` makes import use Ollama on the server. Any other value, or unset, means in-browser WebLLM. Read on every request. |
| `OLLAMA_URL` | `src/lib/import/ollama.ts` | no | Default `http://localhost:11434`. Read once, at module load. |
| `OLLAMA_MODEL` | `src/lib/import/ollama.ts` | no | Default `gemma2:2b`. Read once, at module load. |
| `GEMINI_API_KEY` | `src/lib/import/gemini.ts` | no | Used by `callGemini`, which no route calls at the moment (Gemini fallback paused). |
| `HEADED` | `scripts/bench-llm.ts` | no | `1` shows the benchmark's Chrome window. |

The `!` non-null assertions in the Supabase clients mean a missing variable shows up as a Supabase client error at runtime, not as a startup check.

## GitHub Actions secrets

| Secret | Workflow | Value |
|---|---|---|
| `SUPABASE_URL` | `keepalive.yml` | Project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | `keepalive.yml` | Anon key |
| `SUPABASE_DB_URL` | `backup.yml` | Postgres connection URI used by `supabase db dump` |

## Examples

```dotenv
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://tfysxpkfbumctfuxcend.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # only for scripts/backfill-ingredient-macros.ts
# LLM_MODE=server
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=gemma2:2b
```

## Related

- [[references]]
- [[api-routes]]
- [[github-workflows]]
- [[llm-modes]]

## Sources

- `grep -rn "process.env" src scripts` at the verified commit, plus the two workflow files.

## Changelog

- 2026-10-09: Re-verified against a7f8f52; no content change (a repo-wide `process.env` grep matches the table).
- 2026-10-04: Created.
