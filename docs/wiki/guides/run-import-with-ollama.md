---
title: "Run Import with Ollama"
summary: "Serve recipe extraction from a local Ollama (LLM_MODE=server) so any browser, including phones on the LAN, can import recipes."
tags: [llm, import, dev-setup]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "Ollama client"
    path: src/lib/import/ollama.ts
  - title: "Extract route"
    path: src/app/api/import/extract/route.ts
---

# Run Import with Ollama

> [!tldr]
> `ollama pull gemma2:2b`, then start the app with `LLM_MODE=server`. `GET /api/import/extract` should return `{"mode":"server"}`, and imports then run on the server's GPU.

## Context

Browser mode needs WebGPU and downloads about 1.5 GB per browser. Server mode moves the model to the machine running `pnpm dev`. See [[llm-modes]] and [[guides]].

## Prerequisites

- [Ollama](https://ollama.com) installed and running (default `http://localhost:11434`).
- A GPU helps. A cold start plus generation took up to about 20 s in the benchmark.

## Steps

1. Pull the model:

   ```bash
   ollama pull gemma2:2b
   ```

2. Start the app in server mode:

   ```powershell
   $env:LLM_MODE='server'; pnpm dev -H 0.0.0.0
   ```

   ```bash
   LLM_MODE=server pnpm dev -H 0.0.0.0
   ```

3. Optional: point at another host or model with `OLLAMA_URL` / `OLLAMA_MODEL`. These are read at module load, so restart after changing them.

## Verify

```bash
curl -b cookies.txt http://localhost:3000/api/import/extract   # {"mode":"server"} (needs a session cookie)
```

In the app: `/recipes/new` → „Import z URL" → paste an aniagotuje.pl or jadlonomia.com recipe. The dialog skips the model-loading stage.

## Troubleshooting

| Symptom | Cause |
|---|---|
| 502 `Ollama 404 …` | Model not pulled, or `OLLAMA_MODEL` names a missing model |
| 502 `fetch failed` | Ollama isn't running or `OLLAMA_URL` is wrong |
| 502 `LLM failed to produce valid recipe` | 3 invalid outputs (page without a recipe, or one cropped badly; see [[html-cleaning]]) |
| A timeout after 120 s | Ollama hung |

## Examples

```bash
OLLAMA_URL=http://gpu-box:11434 OLLAMA_MODEL=gemma2:2b LLM_MODE=server pnpm dev
```

## Related

- [[guides]]
- [[llm-modes]]
- [[run-llm-benchmark]]
- [[env-vars]]

## Sources

- `src/lib/import/ollama.ts`, `src/app/api/import/extract/route.ts`; `ollama list` shows `gemma2:2b` on the verifying machine

## Changelog

- 2026-10-04: Created from the "Server-side local LLM" section of legacy `import.md`.
