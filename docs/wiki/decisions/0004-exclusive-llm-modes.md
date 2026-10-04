---
title: "0004 Exclusive LLM Modes"
summary: "Recipe extraction runs either in the browser (WebLLM) or on the server (Ollama), chosen by LLM_MODE, with no fallback between them; Gemini is paused."
tags: [llm, import]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "Extract route"
    path: src/app/api/import/extract/route.ts
  - title: "Import dialog"
    path: src/components/import/ImportDialog.tsx
  - title: "Gemini client"
    path: src/lib/import/gemini.ts
---

# 0004 Exclusive LLM Modes

> [!tldr]
> `LLM_MODE=server` means every import goes through Ollama. Otherwise every import runs WebLLM in the browser. Neither mode falls back to the other, and the Gemini Flash fallback from the plan is paused.

## Context

The plan specified WebLLM in the browser with a free Gemini Flash fallback for browsers without WebGPU. In practice, phones on the LAN have no WebGPU (no secure context), in-browser Gemma could hang or lose its GPU device, and a local GPU with Ollama was available. See [[decisions]].

## Decision

**Status:** accepted (commits `7f30052`, `8e524d1`).

- `GET /api/import/extract` reports the mode, and `ImportDialog` follows it.
- No automatic fallback: an error is shown instead.
- `callGemini` stays in the code but no route calls it.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- Browser first, with server fallback: the failure behaviour is harder to predict, and a deployment without Ollama would turn every fallback into a slow 502.
- Keep Gemini: it needs an API key and sends recipe pages to a third party.

## Consequences

- It's always clear which runtime ran.
- Browser mode on a device without WebGPU can't import at all.
- Restoring Gemini means designing a fallback policy again (see [[llm-modes#Known gaps]]).

## Related

- [[decisions]]
- [[llm-modes]]
- [[import-pipeline]]

## Sources

- `src/app/api/import/extract/route.ts`, `src/components/import/ImportDialog.tsx` (comment: "Modes are exclusive (Gemini fallback is paused)"), `src/lib/import/gemini.ts`
- Commits `7f30052` (LLM_MODE) and `8e524d1` (exclusive modes)

## Changelog

- 2026-10-04: Recorded retroactively.
