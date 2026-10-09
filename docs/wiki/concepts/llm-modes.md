---
title: "LLM Modes"
summary: "The two exclusive extraction runtimes selected by LLM_MODE: in-browser WebLLM (WebGPU, Web Worker) and server-side Ollama; the paused Gemini fallback."
tags: [llm, import]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Extract route (mode switch)"
    path: src/app/api/import/extract/route.ts
  - title: "Import dialog"
    path: src/components/import/ImportDialog.tsx
  - title: "WebLLM engine"
    path: src/lib/import/engine.ts
  - title: "Web Worker"
    path: src/lib/import/worker.ts
  - title: "Ollama client"
    path: src/lib/import/ollama.ts
  - title: "Gemini client (paused)"
    path: src/lib/import/gemini.ts
  - title: "Engine tests"
    path: tests/unit/import/engine.test.ts
  - title: "ImportDialog tests"
    path: tests/unit/import/ImportDialog.test.tsx
---

# LLM Modes

> [!tldr]
> `LLM_MODE=server` sends extraction to Ollama on the server. Anything else runs WebLLM in a Web Worker in the browser. The two modes are **exclusive**: no fallback in either direction. A browser without WebGPU gets an error in browser mode. Gemini is paused: `callGemini` exists but nothing calls it.

## Context

Both runtimes use the gemma-2-2b family and the same grammar (see [[llm-extraction]]). The choice is about where the GPU is. See [[concepts]], [[import-pipeline]] and the [[glossary]].

## How it works

`ImportDialog.run()` calls `GET /api/import/extract`, which returns `{ mode }` based on `process.env.LLM_MODE === 'server'` at request time.

| | Browser mode (default) | Server mode |
|---|---|---|
| Runtime | `@mlc-ai/web-llm` `CreateWebWorkerMLCEngine` in `worker.ts` | Ollama `POST /api/chat` |
| Model | `gemma-2-2b-it-q4f16_1-MLC` (about 1.5 GB download, cached by the browser) | `OLLAMA_MODEL`, default `gemma2:2b` |
| Requirements | WebGPU (`hasWebGpu()` asks for an adapter) and a secure context | Ollama reachable at `OLLAMA_URL` (default `localhost:11434`) |
| Timeouts | Model init: 10 minutes | 120 s per call (`AbortSignal.timeout`) |
| Retries | none (single call) | `extractRecipe`, 2 retries |
| Failure | Error in the dialog. On a failed call, `resetEngine()` terminates the worker so a lost GPU device frees its VRAM and the next attempt starts over. | 502 with the error text |

`engine.ts` keeps one worker and one `enginePromise` in module state. `ensureEngineReady(onProgress)` reports download progress to the dialog's progress bar.

## Invariants and gotchas

- **Phones on `http://<lan-ip>` have no WebGPU** (not a secure context), so they can only import when the server runs with `LLM_MODE=server`.
- `OLLAMA_URL` and `OLLAMA_MODEL` are read once, at module load. Restart the dev server after changing them. `LLM_MODE` is read on every request.
- Terminate the worker rather than just dropping `enginePromise`; otherwise the GPU memory leaks.
- An earlier wiring bug hung in-browser Gemma forever (fixed in `0ef792f`). `worker.ts` must stay a bare `WebWorkerMLCEngineHandler` bound to `self.onmessage`.
- A server deployment with no Ollama behind it turns every server-mode import into a 502.

## Known gaps

- Gemini fallback is paused (see [[spec-drift#Planned but not built]]). Bringing it back means choosing a fallback policy, which is exactly what the exclusive-modes decision removed.
- `worker.ts` and the real WebGPU path are verified only manually or with `pnpm bench:llm`, not in CI.

## Examples

```powershell
$env:LLM_MODE='server'; pnpm dev -H 0.0.0.0   # LAN access, server-side LLM
```

## Related

- [[concepts]]
- [[llm-extraction]]
- [[import-pipeline]]
- [[env-vars]]
- [[0004-exclusive-llm-modes]]
- [[run-import-with-ollama]]

## Sources

- `src/app/api/import/extract/route.ts`, `src/components/import/ImportDialog.tsx`, `src/lib/import/{engine,worker,ollama,gemini}.ts`
- `tests/unit/import/engine.test.ts`, `ImportDialog.test.tsx`, `extract-route.test.ts`
- Commits `7f30052` (LLM_MODE), `8e524d1` (exclusive modes), `df8755a` (GPU device-loss recovery), `0ef792f` (worker wiring)

## Changelog

- 2026-10-09: Re-verified against a7f8f52; no content change (the import files changed since 656711c only in formatting, and the mode switch, Ollama and Gemini code are unchanged).
- 2026-10-04: Created from the "Server-side local LLM" and "Gemini fallback" sections of legacy `import.md`.
