---
title: "0005 JSON-Schema Constrained Decoding"
summary: "Both LLM runtimes decode under a JSON-Schema grammar (LLM_OUTPUT_SCHEMA) instead of plain JSON mode."
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
  - title: "Output schema"
    path: src/lib/import/schema.ts
  - title: "WebLLM engine"
    path: src/lib/import/engine.ts
  - title: "Ollama client"
    path: src/lib/import/ollama.ts
  - title: "HTML cleaning (quote fix)"
    path: src/lib/import/clean.ts
---

# 0005 JSON-Schema Constrained Decoding

> [!tldr]
> The model's output is constrained by a grammar compiled from `LLM_OUTPUT_SCHEMA`: Ollama `format`, WebLLM `response_format.schema`. Validation (`RecipeJsonLdSchema`) still runs afterwards.

## Context

In plain JSON mode, gemma-2-2b sometimes looped on whitespace inside a string until it hit max tokens, leaving truncated JSON. Validation plus retries caught it, but at the cost of slow, repeated calls. See [[decisions]].

## Decision

**Status:** accepted.

- One JSON Schema (`LLM_OUTPUT_SCHEMA`), narrower than the Zod schema, shared by both runtimes.
- It goes together with `polishQuotes` in `cleanHtml`, because ASCII `"` in the input triggered the escaping failure.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- Plain JSON mode plus more retries: slower and still unreliable.
- A larger model: doesn't fit the in-browser budget.

## Consequences

- Output is structurally valid far more often, and the grammar also bounds whitespace.
- Two schemas to keep in sync: `LLM_OUTPUT_SCHEMA` (JSON Schema) and `RecipeJsonLdSchema` (Zod). See [[llm-extraction#Invariants and gotchas]].

## Related

- [[decisions]]
- [[llm-extraction]]
- [[html-cleaning]]

## Sources

- Comments in `src/lib/import/schema.ts` and `src/lib/import/clean.ts`, plus `engine.ts` and `ollama.ts`

## Changelog

- 2026-10-04: Recorded retroactively.
