---
title: "Run the LLM Benchmark"
summary: "Compare browser (WebLLM) and server (Ollama) extraction speed and success on 10 live recipe pages with pnpm bench:llm."
tags: [llm, import, testing]
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
  - title: "Benchmark script"
    path: scripts/bench-llm.ts
---

# Run the LLM Benchmark

> [!tldr]
> `pnpm bench:llm [server|browser|both]` fetches and cleans 10 live pages from aniagotuje.pl and jadlonomia.com, then runs the same `extractRecipe` retry loop through Ollama and/or WebLLM in your installed Chrome. It prints per-page time, call count and success, plus cold vs amortized totals.

## Context

Use it before changing cleaning, prompts, the grammar or the model, to see whether extraction got faster or more reliable. It measures success and timing, not field accuracy. See [[guides]] and [[llm-extraction]].

## Prerequisites

- Ollama installed and on `PATH` for both modes: the script calls `ollama stop` before each run, even in `browser` mode.
- For `server`: Ollama running with `gemma2:2b` (default; override with `OLLAMA_MODEL`, see [[run-import-with-ollama]]). The `ollama stop` call forces a cold start.
- For `browser`: Google Chrome installed (Playwright `channel: 'chrome'`) with WebGPU. The first run downloads about 1.5 GB into `.bench-chrome/` (gitignored).
- Network access to the 10 URLs listed in `scripts/bench-llm.ts`.

## Steps

```bash
pnpm bench:llm            # both
pnpm bench:llm server
HEADED=1 pnpm bench:llm browser   # show the Chrome window
```

## Verify

The output ends with `console.table` summaries. Every row should show `ok: true`, and `calls: 1` is ideal (it means no retries were needed).

## Troubleshooting

| Symptom | Cause |
|---|---|
| A page fails in both modes | The site changed. Re-check [[html-cleaning]] on that page. |
| Browser load is very slow on the first run | The model is downloading. That time is reported separately. |
| `ollama: command not found` | Ollama isn't on `PATH` (the script shells out to `ollama stop`) |

## Examples

```bash
pnpm bench:llm server 2>&1 | tee bench-$(date +%F).log
```

## Related

- [[guides]]
- [[llm-modes]]
- [[llm-extraction]]

## Sources

- `scripts/bench-llm.ts`

## Changelog

- 2026-10-09: Re-verified against a7f8f52. Added that `ollama stop` also runs in `browser` mode, so Ollama must be installed for both modes, and documented the `OLLAMA_MODEL` override.
- 2026-10-04: Created from the benchmark paragraph of legacy `import.md`.
