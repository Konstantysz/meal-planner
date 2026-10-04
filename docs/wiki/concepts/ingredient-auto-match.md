---
title: "Ingredient Auto-Match"
summary: "How imported ingredient lines are parsed into name/amount/unit and matched to the ingredient database, with Open Food Facts and placeholder fallbacks."
tags: [import, ingredients]
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
  - title: "Auto-match orchestrator"
    path: src/lib/import/auto-match.ts
  - title: "Line parser"
    path: src/lib/import/parse-ingredient.ts
  - title: "Name matcher"
    path: src/lib/import/match-ingredient.ts
  - title: "Review form"
    path: src/components/import/ImportReviewForm.tsx
  - title: "Auto-match tests"
    path: tests/unit/import/auto-match.test.ts
  - title: "Leczo regression test"
    path: tests/unit/import/auto-match.leczo.test.ts
---

# Ingredient Auto-Match

> [!tldr]
> „Auto-mapuj składniki" parses each extracted line („cebula np. cukrowa 300 g") into name, amount and unit, cleans the name, and matches it by word overlap against the local ingredients. If there's no local match **with macros**, it tries Open Food Facts. If that finds nothing either, it creates a bare placeholder. New rows are created when the user clicks the button, not when they save.

## Context

Before this existed (commit `e7cda69`), users had to re-pick every imported ingredient by hand. See [[concepts]], [[import-pipeline]] and [[ingredient-database]].

## How it works

`autoMatchIngredients(rawLines, localIngredients, { searchOff })`, for each line:

1. `parseIngredientLines(raw)` splits compound lines („chili i kumin po 1/4 łyżeczki" becomes two entries sharing the amount). Otherwise it calls `parseIngredientLine`: the **first** amount+unit match (numbers, `1/4`, `1,5`, „pół", „ćwierć", followed by g/kg/ml/l/szt/ząbek/łyżeczka/łyżka/szklanka/opakowanie forms). Units are normalised (`łyżki` → `łyżka`). The name is the text before the match.
2. `cleanIngredientName` drops „np. …" suggestions and parentheticals.
3. `findBestMatch(name, local)`: exact match scores 1, substring 0.8, otherwise word overlap / max word count. Scores of 0.5 or more count as a match.
4. If the local match has any macro field, it's used. Otherwise `searchOff(name)[0]` becomes an `offCandidate`, which beats a macro-less local match.
5. If there's neither, a `fallbackCandidate`: the name, category `inne`, null macros, `source: 'manual'`.

`ImportReviewForm.autoMatch` then `POST`s each OFF or fallback candidate to `/api/ingredients`, builds the `PickedIngredient[]` list (unit falls back to the ingredient's `default_unit`), and shows a summary notice.

## Invariants and gotchas

- `raw_text` stored on the recipe is the **clean name only**. Amount and unit live in their own fields.
- A macro-less local match is kept only when OFF has nothing (commit `df8755a`). Before that fix, placeholders shadowed real data.
- The parser keeps only the first quantity: „400 g - 2 sztuki" gives 400 g. That's a deliberate `ponytail:` simplification.
- A failed create (for example a name collision with `lower(name)`) silently drops that line. The notice then reports fewer matches.
- Matching is substring plus word overlap, not edit distance. „pomidory" matches „pomidor" (substring), but an inflection that changes the stem, like „jajka" vs. „jajko", doesn't match. A `ponytail:` comment names a fuzzy-matching library as the upgrade.

## Known gaps

- Ingredient rows are created when the user clicks „Auto-mapuj", so they stay in the shared table even if the user then cancels the import.
- OFF results are often packaged products (brand names), and the first hit is taken without ranking.

## Examples

```ts
parseIngredientLine('czosnek świeży 6 ząbków');         // { name: 'czosnek świeży', amount: 6, unit: 'ząbek' }
parseIngredientLines('chili i kumin po 1/4 łyżeczki'); // two entries, amount 0.25, unit 'łyżeczka'
```

## Related

- [[concepts]]
- [[import-pipeline]]
- [[ingredient-database]]
- [[recipe-yield-parsing]]

## Sources

- `src/lib/import/{auto-match,parse-ingredient,match-ingredient}.ts`, `src/components/import/ImportReviewForm.tsx`
- `tests/unit/import/auto-match*.test.ts`, `parse-ingredient.test.ts`, `match-ingredient.test.ts`
- Commits `e7cda69` (auto-match) and `df8755a` (keep macro-less local matches)

## Changelog

- 2026-10-04: Created. Replaces the stale legacy claim that the review form doesn't auto-match.
