---
title: "Amount Scaling and Formatting"
summary: "Unit-aware rounding and formatting of ingredient amounts, and the (currently unused) scaleAmount helper."
tags: [recipes, macros]
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
  - title: "Scaling functions"
    path: src/lib/scaling.ts
  - title: "Scaling tests"
    path: tests/unit/scaling.test.ts
  - title: "Shopping aggregation (does its own scaling)"
    path: src/lib/shopping-list.ts
---

# Amount Scaling and Formatting

> [!tldr]
> `src/lib/scaling.ts` rounds amounts to whole numbers for `g`/`ml` and to 2 decimals for everything else, and formats them as `"<n> <unit>"`. Only `formatAmount` is used, on the recipe detail page. `scaleAmount` is tested but no UI calls it. The shopping list scales amounts with its own inline factor.

## Context

The plan expected portion scaling in the recipe view. That UI doesn't exist yet. See [[concepts]].

## How it works

| Function | Behaviour |
|---|---|
| `roundForUnit(n, unit)` | `g` or `ml` (case-insensitive) → `Math.round`; anything else → 2 decimals |
| `formatAmount(n, unit)` | `"${rounded} ${unit}"`, or just the number when `unit` is null |
| `scaleAmount(item, factor)` | `amount * factor`, and rewrites `raw_text` to the formatted amount. Null `amount` is returned unchanged ("do smaku", to taste). |

## Invariants and gotchas

- `scaleAmount` **replaces** `raw_text` with just the amount and unit, dropping the ingredient name. Callers have to keep the name separately.
- `aggregateShoppingList` doesn't use `scaleAmount`. It multiplies by `servings / base_servings` itself (see [[shopping-list-aggregation]]).
- The `kg`/`l` branch in `roundForUnit` behaves the same as the default branch.

## Known gaps

- No "change servings" control on the recipe detail page, so `scaleAmount` has no caller.

## Examples

```ts
formatAmount(12.345, 'g');   // "12 g"
formatAmount(0.333, 'łyżka'); // "0.33 łyżka"
scaleAmount({ amount: 2, unit: 'g', raw_text: '2 g' }, 1.5); // { amount: 3, unit: 'g', raw_text: '3 g' }
```

## Related

- [[concepts]]
- [[macro-calculation]]
- [[shopping-list-aggregation]]

## Sources

- `src/lib/scaling.ts`, `tests/unit/scaling.test.ts`, `src/lib/shopping-list.ts`

## Changelog

- 2026-10-04: Created.
