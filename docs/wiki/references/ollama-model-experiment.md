---
title: "Ollama Model Experiment"
summary: "Benchmark of alternatives to gemma2:2b on a 6 GB GPU: speed on 2026-10-10 (none beat it), quality on 2026-10-11 (gemma4:e2b wins, now the default)."
tags: [import, llm]
status: draft
owner: "@konstantysz"
created: 2026-10-10
updated: 2026-10-11
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
> On the dev machine (GTX 1660 Ti, 6 GB VRAM) the first round (2026-10-10) measured only speed and parse success, and `gemma2:2b` stayed the default. The quality round (2026-10-11) found `gemma4:e2b` far better on ingredient amount and unit at about 1.3x the time per page, so it is now the default. `bonsai-27b` is 9x slower; `qwen3:4b` and `gemma3:4b` timed out.

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

## Quality round (2026-10-11)

`pnpm eval:ingredients` on the 115-entry corpus, three runs per model, same `SYSTEM_PROMPT`, same `normalizeUnit`, no extraction failures:

| Model | name | amount | unit | teaspoon read as tablespoon |
|---|---|---|---|---|
| `gemma2:2b` | 93-94% | 75% | 69-70% | 26 of 53 |
| `gemma4:e2b` | 93-94% | 88-92% | 87-92% | 6 of 54 |

Then `pnpm bench:llm server` with `gemma4:e2b` on the 10 live pages: 10/10 parsed, no retries, median 28 s, slowest 35 s (limit 120 s), load 12 s. In this run `ollama ps` showed `gemma4:e2b` fully on the GPU (1.7 GB), so the "partly on CPU" note above may be out of date.

The gain is in exactly what prompt wording could not fix: three prompt variants (a rewritten prompt, a 5 ml / 15 ml rule, a closed unit list) did not move `gemma2:2b`'s teaspoon/tablespoon confusion. Name accuracy is the same for both.

## Not measured

`Underdog-Saluki-27B` was not run: its file is 7.9 GB and is not on Ollama. The prompt was tuned on `gemma2:2b`; a shorter prompt for `gemma4:e2b` was not tried. A closed unit list in the decoding grammar was tried and dropped: `gemma2:2b` then completes the word to the nearest allowed one ("płaska" became "plaster").

## Next steps if pursued

1. A bigger model needs more VRAM (a 12 GB card or more); retest then.
2. To retry a reasoning model, add `think: false` to the request body and make the timeout configurable. Neither was kept.

## Related

- [[run-import-with-ollama]]
- [[run-llm-benchmark]]
- [[llm-modes]]

## Sources

- `scripts/bench-llm.ts` and `src/lib/import/ollama.ts` for the setup. Timings come from local runs on 2026-10-10; raw logs were not kept.

## Changelog

- 2026-10-11: Added the quality round; `gemma4:e2b` became the default.
- 2026-10-10: Created.
