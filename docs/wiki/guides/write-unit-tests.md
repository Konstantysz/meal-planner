---
title: "Write Unit Tests"
summary: "Vitest setup and the five mocking patterns used in this repo: pure functions, Supabase query chains, module mocks, fetch stubs, and route handlers."
tags: [testing]
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
  - title: "Vitest config"
    path: vitest.config.ts
  - title: "Test setup"
    path: tests/setup.ts
  - title: "Supabase chain mock example"
    path: tests/unit/db/ingredients.test.ts
  - title: "Module mock + resetModules example"
    path: tests/unit/import/engine.test.ts
  - title: "Route handler example"
    path: tests/unit/import/extract-route.test.ts
  - title: "Component + fetch stub example"
    path: tests/unit/import/ImportDialog.test.tsx
---

# Write Unit Tests

> [!tldr]
> Vitest runs in jsdom with globals, the `@/` alias and jest-dom matchers. Put tests in `tests/unit/` mirroring `src/`. Prefer pure functions. For I/O, inject a dependency (`LlmFn`, `searchOff`) or mock the Supabase query chain. Route handlers can be called directly with a `Request`.

## Context

`AGENTS.md` says every `src/lib/` function gets a test. See [[test-coverage]] for where that's still missing, and [[guides]].

## Prerequisites

`pnpm install`. Nothing else: tests never touch the network or Supabase.

## Steps

1. Create `tests/unit/<area>/<module>.test.ts` (or `.tsx` for components).
2. Choose a pattern from the table below.
3. Run `pnpm vitest run tests/unit/<area>` while working, and `pnpm test` before committing.

| Pattern | Use for | Example file |
|---|---|---|
| Plain input/output | `macros`, `scaling`, `shopping-list`, `yield`, parsers | `macros.test.ts`, `yield.test.ts` (`it.each`) |
| Injected dependency | Anything with an LLM or OFF call | `extract.test.ts` (fake `LlmFn`), `auto-match.test.ts` (fake `searchOff`) |
| Supabase chain mock | `src/lib/db/*` | `db/ingredients.test.ts`: `from().select().order()` returning `{ data, error }` |
| `vi.mock` + `vi.resetModules` | Modules with state | `engine.test.ts` (fresh module per test, `Worker` stubbed globally) |
| Route handler | `src/app/api/**` | `extract-route.test.ts`: `await import(route)`, call `POST(new Request(…))`, `vi.stubEnv` |
| Component + routed fetch stub | Client components | `ImportDialog.test.tsx`: `vi.hoisted` mocks plus a `fetch` stub keyed by `"METHOD path"` |

## Verify

The new test fails before your change and passes after it (red, then green).

## Troubleshooting

| Symptom | Fix |
|---|---|
| A module mock isn't applied | Use `vi.hoisted` for objects referenced in `vi.mock` factories |
| State leaks between tests | `vi.resetModules()` and re-import (see the engine test) |
| `navigator.gpu` / `Worker` undefined | Stub it with `vi.stubGlobal`. jsdom doesn't provide WebGPU or workers. |

> [!note]
> ESLint rejects `any` (`@typescript-eslint/no-explicit-any`), in tests too. Pass partial Supabase mocks as `as unknown as SupabaseClient`.

## Examples

```ts
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }),
  }),
} as unknown as SupabaseClient;
expect(await listIngredients(mockSupabase)).toEqual(rows);
```

## Related

- [[guides]]
- [[test-coverage]]
- [[local-dev-setup]]

## Sources

- `vitest.config.ts`, `tests/setup.ts`, and the example test files listed in the frontmatter

## Changelog

- 2026-10-09: Re-verified against a7f8f52. Test file paths, the mock patterns and the vitest/jsdom setup all match the code. No changes needed.
- 2026-10-04: Created.
- 2026-10-04: The `as any` mocks were replaced, and ESLint now enforces it.
