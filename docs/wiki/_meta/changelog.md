---
title: "Wiki Changelog"
summary: "Wiki-wide changes: restructures, rule changes, bulk migrations."
tags: [meta]
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
sources: []
---

# Wiki Changelog

> [!tldr]
> Wiki-wide changes, newest first. Per-page changes live in each page's own `## Changelog`.

## Context

Records the changes that affect the wiki as a whole. See [[meta]].

## Entries

- **2026-10-04:** Rebuilt the wiki as an Obsidian vault under [[RULES]]. The 8 flat pages (`auth`, `database`, `recipes`, `plan`, `shopping`, `sharing`, `import`, `ci`) were split into atomic concept, guide, reference and decision pages, verified against commit 656711c. Several stale claims were fixed along the way: signup now uses an RPC, the import review form now auto-matches ingredients, and the repo has a GitHub remote. Added `pnpm wiki:check` and the `Wiki` CI workflow. All pages are LLM-generated and await human review.

## Related

- [[README]]

## Sources

- Git history of `docs/wiki/`.

## Changelog

- 2026-10-04: Created.
