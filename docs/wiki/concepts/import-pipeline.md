---
title: "Import Pipeline"
summary: "End-to-end URL import: fetch and clean on the server, LLM extraction in browser or server, then human review with auto-matching before save."
tags: [import, llm, recipes]
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
  - title: "Import dialog"
    path: src/components/import/ImportDialog.tsx
  - title: "Import review form"
    path: src/components/import/ImportReviewForm.tsx
  - title: "New recipe page"
    path: src/app/(app)/recipes/new/page.tsx
  - title: "Fetch route"
    path: src/app/api/import/fetch/route.ts
  - title: "Extract route"
    path: src/app/api/import/extract/route.ts
  - title: "Page fetcher"
    path: src/lib/import/fetch.ts
---

# Import Pipeline

> [!tldr]
> „Import z URL" on `/recipes/new` runs three stages. **Fetch and clean** happens on the server (HTML → Markdown). **Extract** runs an LLM, either WebLLM in the browser or Ollama on the server depending on `LLM_MODE`, and produces a validated `RecipeJsonLd`. **Review**: the user edits the result, auto-matches ingredients and saves through the normal `POST /api/recipes`. Nothing is saved without that review.

## Context

The target sites are jadlonomia.com and aniagotuje.pl. Each stage has its own page. This page shows how they connect. See [[concepts]].

## How it works

```mermaid
sequenceDiagram
  participant D as ImportDialog
  participant F as /api/import/fetch
  participant X as /api/import/extract
  participant W as WebLLM worker
  participant R as ImportReviewForm
  D->>F: POST {url}
  F-->>D: {markdown} (fetchPage + cleanHtml)
  D->>X: GET (mode?)
  alt mode = server
    D->>X: POST {markdown}
    X-->>D: RecipeJsonLd (Ollama, retries)
  else mode = browser
    D->>W: ensureEngineReady + extractWithWebLlm
    W-->>D: RecipeJsonLd
  end
  D->>R: onExtracted(recipe, url)
  R->>R: Auto-mapuj składniki (optional)
  R->>R: POST /api/recipes
```

| Stage | Page |
|---|---|
| Fetch (`fetchPage`: custom User-Agent, throws on non-2xx) + clean (`cleanHtml`) | [[html-cleaning]] |
| Choosing browser or server | [[llm-modes]] |
| Prompt, grammar, validation, retries | [[llm-extraction]] |
| Mapping ingredient lines to DB rows | [[ingredient-auto-match]] |
| `recipeYield` → servings | [[recipe-yield-parsing]] |

The `ImportDialog` stage machine is `idle → fetch → (model) → extract → done`, and any exception moves it to `error`, with the message shown inline. `/recipes/new` swaps `RecipeForm` for `ImportReviewForm` once a recipe has been extracted, and passes the source URL through as `source_url` (commit `b1bd2db`).

## Invariants and gotchas

- **Review is mandatory.** `ImportReviewForm.save` refuses to save until at least one ingredient is mapped („Zmapuj co najmniej jeden składnik przed zapisem.").
- Imported recipes get `prep_time_min: null`, `diet_tags: []`, `allergens: []` and `visibility: 'household'`. The extracted `prepTime` is dropped.
- `recipeInstructions` can be a string, an array of strings, or an array of `{text}`. The review form normalises all three into step strings.
- Review Focus #3 (a page with no recipe) ends in an `extractRecipe` error after retries. Nothing is saved.

## Known gaps

- `/api/import/fetch` fetches any URL for any signed-in user (SSRF). See [[api-routes]].
- No caching. Importing the same URL twice repeats the fetch and the LLM run.

## Examples

```bash
# Server mode end to end (see the Ollama guide)
LLM_MODE=server pnpm dev
```

## Related

- [[concepts]]
- [[html-cleaning]]
- [[llm-modes]]
- [[llm-extraction]]
- [[ingredient-auto-match]]
- [[recipe-yield-parsing]]
- [[recipe-management]]

## Sources

- `src/components/import/*`, `src/app/(app)/recipes/new/page.tsx`, `src/app/api/import/**`, `src/lib/import/fetch.ts`

## Changelog

- 2026-10-04: Created from legacy `import.md`. Fixed the stale "review form doesn't auto-match" claim.
