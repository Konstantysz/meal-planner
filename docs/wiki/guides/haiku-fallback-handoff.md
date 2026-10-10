---
title: "Haiku Fallback Handoff"
summary: "Handoff from the Haiku URL experiment: what is decided, what is open, and the smallest next step if a URL-only LLM fallback is wanted."
tags: [import, llm]
status: draft
owner: "@konstantysz"
created: 2026-10-10
updated: 2026-10-10
last_reviewed: null
review_interval_days: 90
confidence: low
llm_generated: true
llm_model: "claude-sonnet-5-5"
human_reviewed: false
verified_commit: 57d7dba
sources:
  - title: "RecipeInputSchema"
    path: src/lib/schemas.ts
  - title: "Import orchestrator"
    path: src/lib/import/extract.ts
---

# Haiku Fallback Handoff

> [!tldr]
> Nothing was built; no repo code changed. The experiment in [[haiku-url-extraction-experiment]] suggests a URL-only Haiku call is cheap enough to serve as a fallback for pages the deterministic parser cannot read, if its output is validated with Zod. The decision is open.

## Context

The owner asked out of curiosity, not for a feature. This page records where things stand so a later session can pick it up. Part of [[guides]].

## State

- Branch: `feat/ingredient-parser-stages`, working tree clean at the time of the experiment.
- Not decided: whether to add the fallback at all. [[llm-modes]] and [[0004-exclusive-llm-modes]] currently allow one mode at a time, and the Gemini fallback is paused.
- There is no JSON importer; the experiment output was meant for manual copy-paste.

## Next steps if pursued

1. Decide where a URL-only call runs. A server route needs a fetch tool plus SSRF limits; check [[rls-authorization]] and [[known-gaps]] first.
2. Ask for the `RecipeJsonLd` shape from [[llm-extraction]], not `RecipeInputSchema`, so the existing parser, retry-with-feedback and ingredient matching ([[ingredient-auto-match]]) are reused.
3. Constrain `category` to the enum in the prompt, and validate with Zod. Reject, then retry once with the error.
4. Use the fallback only after the deterministic path fails.
5. Re-run on 5 to 10 pages across both supported sites and record token usage per call (input and output separately) before trusting the cost figure.

## Related

- [[haiku-url-extraction-experiment]]
- [[import-pipeline]]

## Sources

- [[haiku-url-extraction-experiment]] for all measurements.

## Changelog

- 2026-10-10: Created.
