---
title: "Haiku URL Extraction Experiment"
summary: "One-off 2026-10-10 test: a Haiku 5.5 subagent given only a URL produced a near-valid recipe JSON for about half a cent."
tags: [import, llm]
status: draft
owner: "@konstantysz"
created: 2026-10-10
updated: 2026-10-10
last_reviewed: null
review_interval_days: 180
confidence: low
llm_generated: true
llm_model: "claude-sonnet-5-5"
human_reviewed: false
verified_commit: 57d7dba
sources:
  - title: "RecipeInputSchema (target shape)"
    path: src/lib/schemas.ts
  - title: "Deterministic import pipeline"
    path: src/lib/import/extract.ts
---

# Haiku URL Extraction Experiment

> [!tldr]
> A Haiku 5.5 subagent with a prompt, the URL and a web-fetch tool returned a plausible recipe JSON for `aniagotuje.pl/przepis/pad-thai` in 35 s for 52,622 tokens (about half a cent at most). The JSON failed our schema on one enum value and dropped ingredient alternatives. One sample only.

## Context

Question from the owner: what would a no-preprocessing, agentic LLM parse cost compared with the deterministic pipeline in [[import-pipeline]] and the extraction step in [[llm-extraction]]? Run on branch `feat/ingredient-parser-stages`. See [[references]] for the index.

## Setup

| Item | Value |
|---|---|
| Model | Haiku 5.5 subagent ($0.10 in / $0.50 out per million tokens up to 100K; $0.50 / $2.50 above) |
| Input | Prompt with the target JSON shape plus the URL; no HTML, no Markdown, no cleaning |
| Tools | `WebFetch` (2 tool calls) |
| Target | `RecipeInputSchema` shape, with ingredient `name` and `category` instead of `ingredient_id` UUIDs |
| Page | `https://aniagotuje.pl/przepis/pad-thai` |

## Results

| Metric | Result |
|---|---|
| Tokens (subagent total, input and output combined) | 52,622 |
| Duration | 35 s |
| Cost | At most $0.0053 if all tokens were input; realistically about $0.005 |
| Deterministic pipeline | No per-recipe cost |

The input/output split was not reported, so the cost is an upper-bound estimate. The cost of the model inside `WebFetch` is not included.

Output quality:

- 20 ingredients with amount, unit, name and verbatim `raw_text`; 7 steps; carrot flagged `optional`.
- Category `"makaron"` is not in the enum (`"makarony"`), so Zod would reject the JSON.
- Alternatives ("kurczaka, krewetek lub tofu"; "szalotki, cebulki dymki lub szczypiorku") survive only in `raw_text`.
- `gluten` missing from allergens although the recipe uses soy sauce; eggs filed under `nabial` for lack of a better category.
- `servings_base: 4` and `prep_time_min: 60` were not checked against the page.

> [!warning] Uncertain
> One page, one run, nothing diffed against the page by hand. Do not generalise to other sites or to run-to-run variance.

## Related

- [[haiku-fallback-handoff]]: what to do with this result
- [[import-pipeline]]
- [[llm-extraction]]
- [[llm-modes]]

## Sources

- `src/lib/schemas.ts`: `RecipeInputSchema` enums used to judge the output.
- Subagent task notification, 2026-10-10: 52,622 tokens, 2 tool uses, 35,363 ms.

## Changelog

- 2026-10-10: Created.
