---
title: "Meal Planner Wiki"
summary: "Entry point and Map of Content for the meal-planner repository wiki."
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
sources:
  - title: "Agent orientation"
    path: AGENTS.md
  - title: "Domain glossary"
    path: GLOSSARY.md
---

# Meal Planner Wiki

> [!tldr]
> Notes on how the meal-planner PWA actually works: what is true in the code, why, and what is dangerous. Written for coding agents and for humans working with them. Read the page for an area before changing it, and update the page in the same PR.

## Context

`AGENTS.md` gives the one-screen orientation (stack, commands, conventions). This wiki goes one level deeper, one page per concept. Every content page (concepts, guides, references and decisions) carries `verified_commit`: the commit it was checked against. If the code under a page's `sources` has changed since then, treat the page as suspect.

The wiki is an Obsidian vault. Open `docs/wiki/` as a vault to get the graph, backlinks and templates. On GitHub the `[[wikilinks]]` render as plain text, but the files are still readable.

## Start here

- **Find your way around the code:** [[concepts]], starting with the architecture overview.
- **Do a task:** [[guides]]: local setup, migrations, tests, the LLM server.
- **Look something up:** [[references]]: schema, API routes, env vars, known gaps.
- **Understand why:** [[decisions]]: numbered architecture decisions.
- **Contribute to the wiki:** [[RULES]], then copy a template from `_templates/`.
- **Domain terms:** `GLOSSARY.md` at the repo root (Household, Plan, Slot, Macros, ...).
- **Code symbols and Polish UI strings:** [[code-and-ui-terms]].
- **Tags:** [[meta]].

## Status legend

| Status | Meaning |
|---|---|
| `draft` | Unverified or incomplete. Don't act on it without checking the code. |
| `review` | An LLM checked it against the code at `verified_commit`. A human hasn't reviewed it yet. |
| `stable` | A human reviewed it. |
| `deprecated` | Superseded. Follow the replacement link. |

## Related

- [[RULES]]
- [[code-and-ui-terms]]
- [[changelog]]

## Sources

- `AGENTS.md`: the orientation this wiki extends.
- `GLOSSARY.md`: the domain language, at the repo root.

## Changelog

- 2026-10-09: Re-verified against a7f8f52. Glossary links now point to `GLOSSARY.md` (repo root, domain terms) and [[code-and-ui-terms]] (code symbols and Polish UI strings). Corrected the `verified_commit` claim to content pages.
- 2026-10-04: Rewritten as the vault entry point (MOC) under [[RULES]].
