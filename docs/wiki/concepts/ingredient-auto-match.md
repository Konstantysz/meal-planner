---
title: "Ingredient Auto-Match"
summary: "How imported ingredient lines are parsed into name/amount/unit and matched to the ingredient database, with Open Food Facts and placeholder fallbacks."
tags: [import, ingredients]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-10
last_reviewed: 2026-10-10
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: 7627e7b
sources:
  - title: "Auto-match orchestrator"
    path: src/lib/import/auto-match.ts
  - title: "Line parser"
    path: src/lib/import/parse-ingredient.ts
  - title: "Line splitter (stage 1)"
    path: src/lib/import/split-ingredient.ts
  - title: "Amount and unit vocabulary"
    path: src/lib/import/ingredient-text.ts
  - title: "Name matcher"
    path: src/lib/import/match-ingredient.ts
  - title: "Review form"
    path: src/components/import/ImportReviewForm.tsx
  - title: "Auto-match tests"
    path: tests/unit/import/auto-match.test.ts
  - title: "Ingredient corpus"
    path: tests/unit/import/ingredient-corpus.test.ts
  - title: "Leczo regression test"
    path: tests/unit/import/auto-match.leczo.test.ts
---

# Ingredient Auto-Match

> [!tldr]
> „Auto-mapuj składniki" parses each extracted line („cebula np. cukrowa 300 g") into name, amount and unit, cleans the name, and matches it by word overlap (with a prefix rule for Polish endings) against the local ingredients. If there's no local match **with macros**, it tries Open Food Facts. If that finds nothing either, it creates a placeholder ingredient. New rows are created when the user clicks the button, not when they save.

## Context

Before this existed (commit `e7cda69`), users had to re-pick every imported ingredient by hand. See [[concepts]], [[import-pipeline]] and [[ingredient-database]].

## How it works

`autoMatchIngredients(rawLines, localIngredients, { searchOff })`, for each line:

1. `parseIngredientLines(raw)` runs five stages, each owning one class of problem. A new edge case belongs to exactly one stage:
   1. **Split** (`split-ingredient.ts`): one line becomes several parts. A label prefix („przyprawy:", „przyprawy i zioła:", „dodatki:") is dropped and the rest is split on `,` and `;` outside parentheses, and on „ i " when an amount follows it. Labels with „dodatki", „do podania" or „ewentualnie" mark every part optional. A shared amount is split too: „A i B po <ilość>", „po <ilość> A i B", „szczypta A i B".
   2. **Quantity** (`normalizeText` and `extractQuantity`): text is first normalised to plain digits: Polish number words („pół", „półtora", „jedna trzecia", „dwie trzecie"), Unicode fractions, mixed numbers („1 i 1/2"), „2 x 5" (10) and ranges („30-40", the upper bound wins). Then a metric amount anywhere in the part wins, including the „- około 160 g" tail (macros are per 100 g). Otherwise the first amount+unit, then a bare leading count (below 50 sztuki, else grams), then an approximate unit with no number („łyżka cukru", „spora garść" count as 1). Up to two adjective-like words may sit between amount and unit („2 małe ząbki"). Units are normalised (`łyżek` → `łyżka`, `gramów` → `g`). „liście" and „listki" are not units; they stay in the name.
   3. **Name** (`extractName`): cut the „- …" tail, parentheses, quoted brand names and „np. …", keep the first „ lub " alternative that isn't water, then strip amount phrases, size words („duża", „średnia", „spora", „ulubiona"…), the „po" quantity connector (not „po" inside a name like „makaron po włosku") and a trailing `*` or `..`.
   4. **Flags**: „można pominąć" or „ewentualnie" in the part sets `optional: true` (also set by the stage 1 label). `ParsedIngredient.optional` exists only when true. `autoMatchIngredients` passes it through and `ImportReviewForm` uses `r.optional ?? false`.
   5. **Water filter**: a part is dropped only when every „ lub " alternative is water („woda do moczenia…").

   `parseIngredientLine` runs stages 2 to 4 on a single part.
2. `cleanIngredientName` drops „np. …" suggestions and parentheticals.
3. `findBestMatch(name, local)`: exact match scores 1, substring 0.8, otherwise word overlap / max word count, where two words match when equal or when `wordsMatch` finds a common prefix of at least 4 letters that is at least `min(len) - 3` („czosnku" ~ „czosnek", „pomidorów" ~ „pomidor", „boczku" ~ „boczek"). Words under 4 letters need an exact match („sól" ≠ „sos"). Scores of 0.5 or more count as a match.
4. If the local match has any macro field, it's used. Otherwise `searchOff(name)[0]` becomes an `offCandidate`, which beats a macro-less local match. A failed `searchOff` call counts as no OFF result.
5. If there's neither, a `fallbackCandidate`: the name, category `inne`, null macros, `source: 'manual'`.

`ImportReviewForm.autoMatch` then `POST`s each OFF or fallback candidate to `/api/ingredients`, builds the `PickedIngredient[]` list (unit falls back to the ingredient's `default_unit`), and shows a summary notice.

## Invariants and gotchas

- `raw_text` stored on the recipe is the **clean name only**. Amount and unit live in their own fields.
- A macro-less local match is kept only when OFF has nothing (commit `df8755a`). Before that fix, placeholders shadowed real data.
- The parser keeps one quantity: „400 g - 2 sztuki" gives 400 g, and „3 łyżki oleju - około 30 g" gives 30 g. That's a deliberate `ponytail:` simplification. The bare-number rule (under 50 is a piece count) is a heuristic.
- A failed create (for example a name collision with `lower(name)`) silently drops that line. The notice then reports fewer matches.
- Matching is substring plus word overlap with a common-prefix rule, not a lemmatizer or edit distance. It covers endings („czosnku" ~ „czosnek") but not a short stem, like „mąki" vs. „mąka" (prefix 3, under the 4-letter minimum). Two `ponytail:` comments in `match-ingredient.ts` mark this: word-overlap scoring (upgrade: a real fuzzy library) and the common-prefix heuristic (not a lemmatizer).
- Names are not converted to their base form. When nothing matches, the new ingredient is created under the name as written („czosnku"). See [[known-gaps]].
- The water filter looks at each „ lub " alternative as a whole, so „pomidory + woda" stays one ingredient named „pomidory + woda". See [[known-gaps]].

## Corpus workflow

`tests/unit/import/ingredient-corpus.test.ts` holds real aniagotuje ingredient lines (verbatim from the pages' `.ingredient-text`), each with its expected parse, grouped by recipe, plus extra word-amount lines. After a bad import, paste the failing lines there first (red), then fix the one stage that owns the failure (green). Amounts are compared with `toBeCloseTo` (for 1/3). `parse-ingredient.test.ts` keeps the focused cases.

## Known gaps

- Ingredient rows are created when the user clicks „Auto-mapuj", so they stay in the shared table even if the user then cancels the import.
- The parser sees the model's output, which may rephrase the page's lines, so the corpus (verbatim page text) proves the parser, not the whole import.
- OFF results are often packaged products (brand names), and the first hit is taken without ranking.

## Examples

```ts
parseIngredientLine('czosnek świeży 6 ząbków');         // { name: 'czosnek świeży', amount: 6, unit: 'ząbek' }
parseIngredientLines('chili i kumin po 1/4 łyżeczki'); // two entries, amount 0.25, unit 'łyżeczka'
parseIngredientLine('pół płaskiej łyżeczki soli');      // { name: 'soli', amount: 0.5, unit: 'łyżeczka' }
parseIngredientLine('niecała szklanka mąki (140 g)');   // { name: 'mąki', amount: 140, unit: 'g' }
parseIngredientLine('szczypta soli');                  // { name: 'soli', amount: 1, unit: 'szczypta' }
parseIngredientLine('kilka gałązek tymianku');         // { name: 'tymianku', amount: 3, unit: 'gałązka' } (kilka = 3, parę = 2)
```

## Related

- [[concepts]]
- [[import-pipeline]]
- [[ingredient-database]]
- [[recipe-yield-parsing]]

## Sources

- `src/lib/import/{auto-match,parse-ingredient,split-ingredient,ingredient-text,match-ingredient}.ts`, `src/components/import/ImportReviewForm.tsx`
- `tests/unit/import/auto-match*.test.ts`, `parse-ingredient.test.ts`, `match-ingredient.test.ts`, `ingredient-corpus.test.ts`
- Commits `e7cda69` (auto-match) and `df8755a` (keep macro-less local matches)

## Changelog

- 2026-10-10: Documented the five parser stages, the corpus workflow and prefix matching (`187d7e3`).
- 2026-10-09: Re-verified against `a7f8f52`. Updated the line parser (metric preference, bare counts, modifiers, name cleaning) and the failed-`searchOff` behaviour.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-05: Parser handles quantity-first lines (aniagotuje), prefers metric amounts, strips comment tails, and treats bare leading numbers as counts.
- 2026-10-04: Created. Replaces the stale legacy claim that the review form doesn't auto-match.
