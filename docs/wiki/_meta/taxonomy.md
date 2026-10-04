---
title: "Taxonomy"
summary: "The closed list of tags pages may use, and what each one covers."
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
allowed_tags:
  - architecture
  - auth
  - household
  - database
  - rls
  - security
  - recipes
  - ingredients
  - macros
  - plan
  - shopping
  - offline
  - pwa
  - sharing
  - import
  - llm
  - testing
  - ci
  - dev-setup
  - spec
  - ui
  - meta
---

# Taxonomy

> [!tldr]
> Tags are a closed list, kept in this page's `allowed_tags` property. `pnpm wiki:check` rejects any tag not listed here.

## Context

Inconsistent tags are an anti-pattern (see [[RULES]]). The folder (concepts, guides, references, decisions) already says what kind of page something is, so tags only name the **domain**. See [[meta]] for the other meta pages.

## Tags

| Tag | Covers |
|---|---|
| `architecture` | Request flow, layering, cross-cutting structure |
| `auth` | Supabase Auth sessions, the proxy, login/signup |
| `household` | Households, membership, invites |
| `database` | Postgres schema, migrations, seed |
| `rls` | Row Level Security policies |
| `security` | Anything with a trust-boundary or data-exposure angle |
| `recipes` | Recipe CRUD, forms, detail view |
| `ingredients` | Ingredient database, Open Food Facts lookup, matching |
| `macros` | Calorie and macro calculation, scaling |
| `plan` | Week plan and slots |
| `shopping` | Shopping-list aggregation and UI |
| `offline` | IndexedDB storage, online/offline behaviour |
| `pwa` | Manifest, installability |
| `sharing` | Share links, public plan view |
| `import` | URL import pipeline |
| `llm` | WebLLM, Ollama, Gemini, prompts, decoding |
| `testing` | Vitest, fixtures, coverage |
| `ci` | GitHub Actions |
| `dev-setup` | Local environment, env vars, tooling |
| `spec` | Relationship to the original plan document |
| `ui` | Components, pages, Polish UI strings |
| `meta` | Pages about the wiki itself |

## Adding a tag

Add the tag to `allowed_tags` and to the table above in the same PR as the first page that uses it. Prefer reusing a tag.

## Related

- [[RULES]]
- [[glossary]]

## Sources

- Derived from the domains of `src/` and the existing wiki at commit 656711c.

## Changelog

- 2026-10-04: Created.
