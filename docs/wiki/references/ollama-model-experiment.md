---
title: "Ollama Model Experiment"
summary: "2026-10-10 benchmark of four alternatives to gemma2:2b on a 6 GB GPU: none beat it, so the default stays."
tags: [import, llm]
status: draft
owner: "@konstantysz"
created: 2026-10-10
updated: 2026-10-10
last_reviewed: null
review_interval_days: 180
confidence: medium
llm_generated: true
llm_model: "claude-sonnet-5-5"
human_reviewed: false
verified_commit: c1a7368
sources:
  - title: "Ollama client (model, timeout, request options)"
    path: src/lib/import/ollama.ts
  - title: "Benchmark script"
    path: scripts/bench-llm.ts
---

# Ollama Model Experiment

> [!tldr]
> On the dev machine (GTX 1660 Ti, 6 GB VRAM) no tested model beat `gemma2:2b` for server extraction. `gemma4:e2b` and `bonsai-27b` parsed 10/10 pages but were 2x and 9x slower; `qwen3:4b` and `gemma3:4b` timed out. Decision: keep `gemma2:2b`. Speed and parse success were measured, extraction quality was not.

## Context

The owner asked whether a better model than `gemma2:2b` (the default `OLLAMA_MODEL`, see [[run-import-with-ollama]]) exists for the `LLM_MODE=server` path of [[llm-extraction]]. Nothing in the repo changed; the experiment used temporary local edits that were reverted. Part of [[references]].

## Setup

- Machine: GTX 1660 Ti with 6 GB VRAM (about 1.2 GB used by the desktop), 32 GB RAM.
- Script: `scripts/bench-llm.ts` in `server` mode ([[run-llm-benchmark]]), 10 live pages from aniagotuje.pl and jadlonomia.com, `OLLAMA_MODEL` set per run.
- Request options as in `src/lib/import/ollama.ts`: `num_ctx` 8192, `num_predict` 1536, 120 s timeout.

## Results

| Model | Disk | OK | Median per page | Note |
|---|---|---|---|---|
| `gemma2:2b` (current) | 1.6 GB | 10/10 | 21 s | baseline |
| `gemma4:e2b` | 7.2 GB | 10/10 | 40 s | larger than VRAM, partly on CPU |
| `qwen3:4b` | 2.5 GB | 8/10 | 60 s | two 120 s timeouts; reasons before answering |
| `gemma3:4b` | 3.4 GB | 0/3 | n/a | three timeouts, run stopped |
| `bonsai-27b` | 4.4 GB | 0/2, then 10/10 | 191 s | 1-bit 27B; needed a 300 s timeout, slowest page 278 s |

`qwen3:4b` was run with `think: false` after a first attempt stalled: with thinking on, the reasoning consumed the `num_predict` budget. `gemma3:4b` was not diagnosed; the Ollama log suggested the memory fit forced offloading.

## Not measured

Only timing and whether the output parsed were recorded. Ingredient and step counts were similar for `gemma2:2b` and `bonsai-27b`, but nobody compared content. `Underdog-Saluki-27B` was not run: its file is 7.9 GB and is not on Ollama.

## Next steps if pursued

1. Compare extracted ingredients of `gemma2:2b` and `gemma4:e2b` on a few pages by hand; `gemma4:e2b` is the only candidate that completes every page within the current timeout.
2. A bigger model needs more VRAM (a 12 GB card or more); retest then.
3. To retry a reasoning model, add `think: false` to the request body and make the timeout configurable. Neither was kept.

## Related

- [[run-import-with-ollama]]
- [[run-llm-benchmark]]
- [[llm-modes]]

## Sources

- `scripts/bench-llm.ts` and `src/lib/import/ollama.ts` for the setup. Timings come from local runs on 2026-10-10; raw logs were not kept.

## Changelog

- 2026-10-10: Created.
