---
title: "Recipe Yield Parsing"
summary: "parseYield: turning a schema.org recipeYield string or number into an integer serving count for imported recipes."
tags: [import, recipes]
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
  - title: "parseYield"
    path: src/lib/import/yield.ts
  - title: "Yield tests"
    path: tests/unit/import/yield.test.ts
  - title: "Review form"
    path: src/components/import/ImportReviewForm.tsx
---

# Recipe Yield Parsing

> [!tldr]
> `parseYield` sets the initial base servings on the import review form. A number is rounded. A count („4 porcje", „na 6 osób", „12 sztuk") wins over a weight. A weight („1,5 kg") is divided by an assumed 350 g serving. Anything else falls back to the first number, and with no number at all, 4. The result is always 1 or more.

## Context

`servings_base` must be a positive integer (see [[recipe-management]]), but recipe sites express yield loosely. See [[concepts]] and [[import-pipeline]].

## How it works

| Input | Rule | Result |
|---|---|---|
| number | `max(1, round(n))` | `3.6` → 4, `0` → 1 |
| empty or undefined | default | 4 |
| `(\d+)\s*(porcj\|os\|szt)` | explicit count | „na 6 osób" → 6 |
| `(\d+(?:[.,]\d+)?)\s*(kg\|gram\|g)(?![a-z])` | grams / 350, rounded | „1,5 kg" → 4 |
| any other number | the first number | „2" → 2 |

## Invariants and gotchas

- The weight regex uses `(?![a-z])` instead of `\b`, so „gramów" matches as grams and „garście" (handfuls) doesn't. JavaScript's `\b` doesn't treat Polish letters as word characters.
- `ASSUMED_SERVING_GRAMS = 350` is a guess. The user is expected to correct the base servings on the review form, since the constant itself is not editable there.

## Known gaps

- Volumes („1 l zupy") fall through to "first number" and become 1 serving.

## Examples

```ts
parseYield('4 porcje');  // 4
parseYield('1,5 kg');    // 4  (1500 / 350 ≈ 4.3)
parseYield(undefined);   // 4
```

## Related

- [[concepts]]
- [[import-pipeline]]
- [[ingredient-auto-match]]

## Sources

- `src/lib/import/yield.ts`, `tests/unit/import/yield.test.ts`, `src/components/import/ImportReviewForm.tsx`

## Changelog

- 2026-10-09: Re-verified against `a7f8f52`. Corrected the weight regex to match the code and the description of how the user adjusts the result.
- 2026-10-04: Created.
