---
title: "Decisions"
summary: "Index of architecture decision records."
tags: [meta]
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
sources: []
---

# Decisions

> [!tldr]
> Numbered records of why the code is the way it is.

## Context

Decisions are never deleted. When one is superseded, its page links to the replacement. Part of [[README]].

## Pages

0001–0007 and 0009–0011 were recorded retroactively, from the plan, migrations, code comments and commits: 0001–0007 on 2026-10-04, 0009–0011 on 2026-10-09. 0008 was recorded with its change (migration 0005). Records 0009–0011 describe decisions that were already in the code; none of them was made when its page was written.

| # | Decision | Status |
|---|---|---|
| 0001 | [[0001-rls-is-the-authz-boundary]] | accepted |
| 0002 | [[0002-household-signup-rpc]] | superseded by [[0009-household-created-by-signup-trigger]] (migration 0006) |
| 0003 | [[0003-share-token-rls]] | superseded by 0008 |
| 0004 | [[0004-exclusive-llm-modes]] | accepted |
| 0005 | [[0005-json-schema-constrained-decoding]] | accepted |
| 0006 | [[0006-macros-per-100g]] | accepted |
| 0007 | [[0007-units-never-summed]] | accepted |
| 0008 | [[0008-share-link-rpc]] | accepted |
| 0009 | [[0009-household-created-by-signup-trigger]] | accepted |
| 0010 | [[0010-global-ingredient-catalog]] | accepted |
| 0011 | [[0011-html-to-markdown-import]] | accepted |

## Related

- [[RULES]]

## Sources

- None; navigation page.

## Changelog

- 2026-10-09: Added 0009 (signup trigger), 0010 (global ingredient catalog) and 0011 (HTML to Markdown import); fixed the intro on how records were made.
- 2026-10-09: Marked 0002 superseded by the signup trigger (migration 0006).
- 2026-10-04: Added 0008; marked 0003 superseded.
- 2026-10-04: Created.
