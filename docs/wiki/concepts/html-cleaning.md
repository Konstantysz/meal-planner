---
title: "HTML Cleaning"
summary: "cleanHtml: noise stripping, content-selector choice, Markdown conversion, quote replacement and cropping to the ingredients section within the model budget."
tags: [import, llm]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "cleanHtml"
    path: src/lib/import/clean.ts
  - title: "MAX_MARKDOWN_CHARS"
    path: src/lib/import/schema.ts
  - title: "Clean tests"
    path: tests/unit/import/clean.test.ts
  - title: "jadlonomia fixture"
    path: tests/fixtures/jadlonomia/sample.html
  - title: "aniagotuje fixture"
    path: tests/fixtures/aniagotuje/sample.html
---

# HTML Cleaning

> [!tldr]
> `cleanHtml(html)` uses cheerio and turndown to turn a recipe page into compact Markdown that a 2B model can digest. It strips noise, takes the first content container with more than 200 characters of text, replaces ASCII quotes with „ ”, and crops pages over budget to the title plus the most number-dense „Składniki" section, within 6,000 characters.

## Context

The model's context is small: gemma-2-2b in the browser shares 4,096 tokens across prompt and output. Everything stripped here is tokens the model doesn't waste. See [[concepts]] and [[import-pipeline]].

## How it works

1. **Strip noise:** `script, style, nav, footer, header, aside, iframe, noscript, svg`; media (`img, picture, figure, video`), `form, button`; ad and cookie selectors; comment, share and social blocks; and **nested `[itemtype*="Recipe"]` cards inside the main recipe** (related recipes, whose ingredients used to leak into extraction).
2. **Pick content:** the first match with more than 200 characters of text, in this order: `article[itemtype*="Recipe"]` → `.article-content` → `.entry-content` → `.recipe-content` → `main article` → `article` → `main`; otherwise `body`.
3. **Markdown:** turndown with ATX headings and `-` bullets. A custom rule keeps link text and drops URLs. Three or more newlines collapse to two.
4. **`polishQuotes`:** `"x"` → `„x”`, and any leftover `"` → `”`.
5. **`cropToRecipe`:** if the result is over `MAX_MARKDOWN_CHARS` (6000), find every heading line starting with `składniki` or `ingredients`, score each by the number of digits in the next 600 characters, slice from the best one, put the `# title` back in front, and cut to 6000.

## Invariants and gotchas

- **Why replace quotes:** an ASCII `"` copied into a JSON string makes gemma2 lose track of escaping and loop on whitespace until it hits max tokens. „” never need escaping.
- `MAX_MARKDOWN_CHARS` lives in `schema.ts`, not `clean.ts`, so the client bundle (`engine.ts`) doesn't pull in cheerio and turndown.
- Both fixtures are real pages using schema.org Recipe microdata, so they hit the first selector. A site without microdata falls through to the generic selectors.
- The digit-density crop is a heuristic, marked with a `ponytail:` comment. Per-site selectors are the upgrade path if a source keeps losing its recipe.

## Known gaps

- The page's own JSON-LD (`<script type="application/ld+json">`), which many recipe sites embed, is thrown away with the other scripts instead of being used directly.

## Examples

```ts
import { cleanHtml } from '@/lib/import/clean';
const md = cleanHtml(await fetchPage('https://aniagotuje.pl/przepis/zupa-pomidorowa'));
md.length <= 6000; // true
```

## Related

- [[concepts]]
- [[import-pipeline]]
- [[llm-extraction]]

## Sources

- `src/lib/import/clean.ts`, `src/lib/import/schema.ts`, `tests/unit/import/clean.test.ts`, `tests/fixtures/*/sample.html`

## Changelog

- 2026-10-04: Created from legacy `import.md` (cleaning sections). Added the JSON-LD gap.
