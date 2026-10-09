---
title: "0007 Units Are Never Summed"
summary: "The shopping list groups by ingredient and unit; the same ingredient in different units stays on separate shopping items."
tags: [shopping]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Architecture plan (Review Focus #2)"
    path: docs/plans/architecture_plan_document.md
  - title: "Aggregation"
    path: src/lib/shopping-list.ts
  - title: "Aggregation tests"
    path: tests/unit/shopping-list.test.ts
---

# 0007 Units Are Never Summed

> [!tldr]
> `aggregateShoppingList` keys shopping items by `ingredient_id::unit`. „2 łyżki oliwy" and „100 ml oliwy" become two shopping items, never a wrong sum.

## Context

There's no unit-conversion data (density, piece weight). Summing across units would give confident but wrong amounts. The plan's Review Focus #2 calls this out as a case that can break the app. See [[decisions]].

## Decision

**Status:** accepted (original spec, Review Focus #2: „oczekiwane: dwie linie, nie błędna suma", expected: two shopping items, not a wrong sum). It's pinned by the test `does NOT sum same ingredient in different units`.

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- Converting to grams with a lookup table: more useful, but needs per-ingredient data the app doesn't have.

## Consequences

- Some lists show duplicates for the same product.
- The same key format is used for the have marks in the offline store (`src/lib/offline/shopping-store.ts`, see [[offline-shopping-store]]), so changing it means migrating cached have marks.

## Related

- [[decisions]]
- [[shopping-list-aggregation]]
- [[offline-shopping-store]]

## Sources

- Original spec, `docs/plans/architecture_plan_document.md` (Review Focus), `src/lib/shopping-list.ts`, `tests/unit/shopping-list.test.ts`

## Changelog

- 2026-10-09: Re-verified against `a7f8f52`: key format, test name and the offline have-marks store all match. Replaced "have-map" and "checkbox" with GLOSSARY.md terms.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Recorded retroactively.
