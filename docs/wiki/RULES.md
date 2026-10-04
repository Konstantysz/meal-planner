---
title: "LLM-Wiki Ruleset"
summary: "How pages in this wiki are structured, linked, cited, reviewed and machine-checked."
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

# LLM-Wiki Ruleset

> [!tldr]
> Keep the wiki accurate, atomic, linked, cited and reviewable. `pnpm wiki:check` enforces the mechanical parts; humans own the `stable` status.

## Context

This wiki is read mainly by coding agents, and by humans working through them. These rules keep it trustworthy enough to act on. They are the LLM-Wiki ruleset adopted on 2026-10-04, with the repo-specific amendments marked **(amended)**.

## 1. Core principles

- **Single source of truth:** one canonical page per concept.
- **Atomic pages:** one concept, task or decision per file.
- **Link-first:** dense internal links; no orphan pages.
- **Cite or omit:** every non-obvious claim needs a source.
- **Explicit uncertainty:** mark low-confidence content instead of guessing.
- **Human-in-the-loop:** LLMs may draft, but humans approve `stable` content.
- **Small diffs:** focused changes are easier to review and revert.
- **Update over duplicate:** improve existing pages before creating new ones.

## 2. Layout

**(amended)** The wiki lives in `docs/wiki/` (not `docs/llm-wiki/`). The folder is an Obsidian vault.

```text
docs/wiki/
├── README.md            # Entry point / Map of Content
├── RULES.md             # This ruleset
├── .obsidian/           # Shared vault config (link format, templates)
├── _templates/          # concept, howto, reference, decision
├── _meta/               # meta.md index, taxonomy, glossary, changelog
├── concepts/            # concepts.md index + one page per concept
├── guides/              # guides.md index + one page per task
├── references/          # references.md index + lookup tables
└── decisions/           # decisions.md index + numbered ADRs
```

- Every directory has an index page. **(amended)** Index pages are named after their folder (`concepts/concepts.md`), because basenames must be unique (see §7). `_templates/` is exempt: its files are not pages.
- New pages go in the most specific directory.

## 3. File naming

- Lowercase kebab-case, `.md` extension. Decisions are prefixed with a 4-digit number: `0004-exclusive-llm-modes.md`.
- Names are stable. **(amended)** When renaming, add the old name to the page's `aliases:` property so existing `[[old-name]]` links still resolve.
- Avoid dates in names unless the page is versioned.

## 4. Frontmatter schema

Every page starts with YAML frontmatter. Obsidian shows it as Properties.

```yaml
---
title: "Shopping List Aggregation"
summary: "One-sentence description of the page."
tags: [shopping]                 # only tags listed in [[taxonomy]]
aliases: []                      # optional; old names after a rename
status: review                   # draft | review | stable | deprecated
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null              # date of last human review
review_interval_days: 90
confidence: high                 # low | medium | high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c         # (amended) code state the page was checked against
sources:
  - title: "Aggregation logic"
    path: src/lib/shopping-list.ts       # (amended) repo source: path, no line numbers
  - title: "Open Food Facts API"
    url: "https://world.openfoodfacts.org"
    accessed: 2026-10-04                  # web source: url + accessed
---
```

- `owner` MUST be set before `status: stable`.
- `llm_generated` MUST be `true` if an LLM wrote or substantially edited the page, and `llm_model` MUST then be set.
- `human_reviewed` MUST be `true` only after a human has reviewed the content.
- **(amended)** Repo sources use `path:` (a file that must exist). Web sources use `url:` + `accessed:`.
- **(amended)** `verified_commit` records the commit the page was checked against. To see whether a page is stale, diff its source paths since that commit: `git diff <verified_commit> -- <paths>`.

## 5. Page structure

1. `# Title`, matching `title`.
2. **(amended)** A `> [!tldr]` callout of 1–3 sentences.
3. `## Context`: why the page exists.
4. Body: one or more H2/H3 sections named for their content. **(amended)** Name the sections for what they say, not a literal "Body". Decisions use `## Decision` and `## Consequences`.
5. `## Examples`: concrete code, commands or diagrams, where they help.
6. `## Related`: wikilinks to related pages.
7. `## Sources`: the citations, in readable form.
8. `## Changelog`: notable changes, newest first.

`Context`, `Related`, `Sources` and `Changelog` are required, and so is the TL;DR callout.

## 6. Writing rules

- One concept per page. Split it if it grows too large.
- Define jargon on first use and link to [[glossary]].
- Active voice, short sentences, paragraphs under 5 lines where possible.
- Code fences with language tags. Tables for comparisons. Mermaid fences for diagrams (they render in Obsidian and on GitHub).
- **(amended)** Warnings use Obsidian callouts: `> [!warning]`, `> [!danger]`, `> [!note]`.
- English prose. Polish UI strings are quoted verbatim, e.g. „przepis usunięty".
- **(amended)** Refer to code by repo path and symbol (`src/lib/macros.ts`, `perServing`), never by line number. Code paths are inline code, not links, because wikilinks cannot leave the vault.
- No marketing language, filler or unsourced claims.

## 7. Linking rules

- **(amended)** Internal links are Obsidian wikilinks by basename: `[[week-plan]]`, `[[week-plan|Week plan]]` or `[[week-plan#Deleted recipes]]`. Do not use relative Markdown links between wiki pages. On GitHub, wikilinks render as plain text.
- **(amended)** Page basenames are unique across the vault, so a bare `[[name]]` is never ambiguous.
- Every page links to its folder index (or to [[README]] for top-level pages).
- Every page has at least one inbound link. Orphan pages must be fixed or deleted.
- Don't duplicate content. Link to the canonical page instead.

## 8. Citation rules

- Every non-obvious factual claim has a source. Here that is usually a repo path.
- Prefer primary sources: the code, migrations, official docs, specs.
- Include `accessed` for web sources.
- Quote sparingly and mark quotations clearly.
- If no source exists, set `confidence: low` and explain why.

## 9. LLM contributor rules

- LLMs MUST NOT invent facts, APIs, URLs, quotes or citations.
- LLMs MUST set `llm_generated: true` and `llm_model`.
- LLMs MUST NOT set `status: stable` or `human_reviewed: true`.
- LLMs MUST open a PR and never push directly to `main`.
- LLMs MUST use the templates in `_templates/`.
- LLMs MUST keep diffs focused and leave unrelated pages alone.
- LLMs MUST run `pnpm wiki:check` (link check + markdown lint) before proposing.
- LLMs SHOULD update existing pages rather than create duplicates.
- **(amended)** LLMs SHOULD mark uncertain sections with `> [!warning] Uncertain` followed by the reason.
- **(amended)** When code changes behaviour a page describes, update that page in the same PR and bump `updated` and `verified_commit`.

## 10. Review workflow

- Status flow: `draft` → `review` → `stable` → `deprecated`.
- **(amended)** `review` means an LLM verified the page against the code at `verified_commit`. `draft` means it is unverified or incomplete.
- A human reviewer approves `review` → `stable`.
- `stable` pages have an owner and `last_reviewed`.
- Review intervals: `draft` as needed, `review` 30 days, `stable` 90 days, references 180 days.
- Deprecate instead of deleting: set `status: deprecated` and link the replacement.

## 11. CI / automation

`pnpm wiki:check` runs `scripts/wiki-check.ts` and then `markdownlint-cli2`. Two things run it automatically: the `.githooks/pre-commit` hook (which also checks Prettier formatting and ESLint on staged code files), on any commit that stages wiki files (`pnpm install` enables it through `core.hooksPath`), and the `Wiki` GitHub workflow, on every PR that touches the wiki. `pnpm wiki:fix` auto-fixes markdown style. `.gitattributes` stores every text file with LF endings. The check enforces:

- the frontmatter schema, including the `stable` and `llm_generated` invariants and repo `path:` sources that exist
- the required sections and the TL;DR callout
- that wikilinks, `#heading` anchors and aliases resolve, and basenames are unique
- no orphan pages and no missing link to the folder index
- markdown lint

**(amended)** Deferred until the first `stable` page exists: spell check (it would mostly flag Polish terms), a review label for edits to `stable` pages, and enforced changelog entries for `stable` changes.

## 12. Definition of Done

- Valid frontmatter.
- Follows the page structure.
- At least one outbound link and one inbound link.
- Claims cited or marked uncertain.
- `pnpm wiki:check` passes.
- Human-reviewed if `status: stable`.

## 13. Anti-patterns

Duplicate pages. Unsourced claims. Orphan pages. Stale `stable` pages. Giant pages covering many concepts. Inconsistent tags. LLM-generated content presented as human-reviewed. Direct commits to `main`.

## Related

- [[README]]: the wiki entry point
- [[taxonomy]]: allowed tags
- [[glossary]]: terms
- [[changelog]]: wiki-wide changes

## Sources

- The LLM-Wiki ruleset, provided by the repository owner on 2026-10-04, amended as marked.

## Changelog

- 2026-10-04: Adopted with repo amendments (path, wikilinks, callouts, repo sources, `verified_commit`), plus the pre-commit hook and `.gitattributes`.
