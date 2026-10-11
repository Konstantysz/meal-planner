---
title: "0011 HTML to Markdown Before LLM Extraction"
summary: "Import cleans the fetched page to Markdown and has an LLM extract the recipe from that text, instead of reading the page's own JSON-LD or schema.org markup."
tags: [import, llm]
status: stable
owner: "@konstantysz"
created: 2026-10-09
updated: 2026-10-11
last_reviewed: 2026-10-09
review_interval_days: 180
confidence: medium
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Architecture plan (Global Constraints, Task 14)"
    path: docs/plans/architecture_plan_document.md
  - title: "HTML cleaning"
    path: src/lib/import/clean.ts
  - title: "Character budget and output schema"
    path: src/lib/import/schema.ts
  - title: "Extraction with retries"
    path: src/lib/import/extract.ts
  - title: "Page fetcher"
    path: src/lib/import/fetch.ts
  - title: "Import pipeline"
    path: docs/wiki/concepts/import-pipeline.md
---

# 0011 HTML to Markdown Before LLM Extraction

> [!tldr]
> Import fetches the page, cleans it to Markdown and has an LLM produce the recipe from that text. The page's own JSON-LD is removed with the other scripts, so recipes are never read from page markup directly. See [[import-pipeline]].

## Context

The LLM is the universal extractor: one path reads any recipe page, so the app carries no per-site parsing code (owner, 2026-10-11). The plan asked for `cleanHtml(html): string` returning Markdown (Task 14) and for a JSON-LD `Recipe` shape as the extraction contract (Global Constraints). The model is a small one ([[0005-json-schema-constrained-decoding]]), so `cleanHtml` also limits the text to 6000 characters (`MAX_MARKDOWN_CHARS`). See [[decisions]].

## Decision

**Status:** accepted (plan Task 14; first code in commit `a3f9d84`).

- `cleanHtml` (cheerio and turndown) strips scripts, navigation, ads and comments, takes the first content container, and converts it to ATX Markdown.
- ASCII quotes become „ ” ([[html-cleaning]]).
- Over-budget pages are cropped to the title and the most number-dense ingredients section.
- The model returns the JSON-LD-shaped `RecipeJsonLd`, which is the output contract, not a copy of the page's markup.
- A path around the model needs a new ADR that supersedes this one. That covers reading page markup, a per-site selector, or a parser doing the model's job.

> [!warning] Uncertain
> Whether site coverage (jadłonomia, aniagotuje) was checked is not recorded; the alternatives below are reconstructed.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- Read the page's `Recipe` JSON-LD first and fall back to the model: deterministic when the markup exists, but needs a second code path for pages without it.
- Send raw HTML to the model: no cleaning step, but the markup uses the token budget that the 6000-character limit protects.

## Consequences

- The model can still invent or drop fields, so `RecipeJsonLdSchema` validation, retries and the mandatory review step stay ([[llm-extraction]]).
- Cropping can cut part of a recipe. The crop targets the ingredients section, but this is a heuristic ([[html-cleaning]]).
- Two contracts must match: `LLM_OUTPUT_SCHEMA` (JSON Schema) and `RecipeJsonLdSchema` (Zod) ([[llm-extraction#Invariants and gotchas]]).

## Related

- [[decisions]]
- [[import-pipeline]]
- [[html-cleaning]]
- [[llm-extraction]]
- [[0005-json-schema-constrained-decoding]]
- [[0004-exclusive-llm-modes]]

## Sources

- `docs/plans/architecture_plan_document.md` (Global Constraints: JSON-LD contract; Task 14: `cleanHtml` to Markdown)
- `src/lib/import/clean.ts`, `src/lib/import/schema.ts` (`MAX_MARKDOWN_CHARS`), `src/lib/import/extract.ts`, `src/lib/import/fetch.ts`
- Commit `a3f9d84` (HTML fetch and clean to Markdown, with fixtures)

## Changelog

- 2026-10-11: Recorded the owner's reason (universal extractor, no per-site code) and that a bypass needs a superseding ADR.
- 2026-10-09: Recorded retroactively from the plan, `src/lib/import/*` and commit `a3f9d84`. Rationale for skipping page JSON-LD marked uncertain.
