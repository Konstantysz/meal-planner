# Import

Pipeline: `fetchPage(url)` (`src/lib/import/fetch.ts`) downloads raw HTML with a custom User-Agent → `cleanHtml(html)` (`src/lib/import/clean.ts`) strips noise and converts the main content to Markdown via cheerio + turndown. Later tasks feed that Markdown to an LLM for structured recipe extraction.

`cleanHtml` removes `script, style, nav, footer, header, aside, iframe, noscript, svg` and anything matching `[class*="ad-"]`, `[class*="advert"]`, `[id*="cookie"]`, then tries selectors in order and takes the first match with >200 chars of text: `article[itemtype*="Recipe"]` → `.article-content` → `.entry-content` → `.recipe-content` → `main article` → `article` → `main`, falling back to `body`.

Fixtures (`tests/fixtures/jadlonomia/sample.html`, `tests/fixtures/aniagotuje/sample.html`) are **real HTML**, fetched with curl from live recipe pages (jadlonomia.com/przepisy/dyniowa-pomidorowa, aniagotuje.pl/przepis/zupa-pomidorowa). Both use `<article itemtype=".../Recipe">` (schema.org Recipe microdata), so they hit the first selector in `CONTENT_SELECTORS`.

## LLM extraction (Task 15)

The cleaned Markdown is turned into a `RecipeJsonLd` by an in-browser LLM (WebLLM), with a server-side fallback planned for Task 17 (Gemini).

**Worker architecture** (`src/lib/import/worker.ts` + `src/lib/import/engine.ts`): the model (`gemma-2-2b-it-q4f16_1-MLC`) runs in a dedicated Web Worker via `@mlc-ai/web-llm`'s `CreateWebWorkerMLCEngine`, so downloading/running the model never blocks the main thread. `engine.ts` is the main-thread wrapper: it lazily spawns the worker (`new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`, bundled by Next.js/Turbopack), and talks to it with a simple request/response protocol over `postMessage`:

- main → worker: `{ id, type: 'init' | 'extract', payload }`
- worker → main: `{ id, ok, text? , error? }` for responses, plus unsolicited `{ type: 'progress', progress }` messages during model download/init.

`engine.ts` matches responses to requests with an incrementing `id` and a `pending` map of resolvers/rejecters — a minimal RPC layer over a single worker connection. `hasWebGpu()` lets callers check WebGPU support before attempting to load the model.

**Retry-with-validation-feedback** (`src/lib/import/extract.ts`): `extractRecipe(markdown, llm, systemPrompt, maxRetries)` takes an injectable `LlmFn` (so it's fully unit-testable without a real model), calls it, and tries to parse+validate the response with `parseLlmJson` (`src/lib/import/schema.ts`, which strips code fences then runs `RecipeJsonLdSchema.parse`). On validation failure it retries (up to `maxRetries`, default 2), appending the previous error message to the user prompt so the model gets a second chance with concrete feedback ("poprzednia odpowiedź nie pasowała do schematu (...)"). If all attempts fail — e.g. importing a page with no real recipe content (404, login page) where the LLM has nothing to extract and returns garbage — it throws, so the caller never saves an invalid recipe. This is the behavior covered by Review Focus case #3.

**Test coverage**: `tests/unit/import/extract.test.ts` covers `extractRecipe` with fake `LlmFn`s — valid JSON, retry-then-succeed, exhausted retries on garbage, and JSON missing the required `name` field. `worker.ts` and `engine.ts` are **not** unit-tested: they depend on browser/worker-only APIs (`self.onmessage`, `Worker`, `navigator.gpu`) that don't exist in the Node/Vitest environment. They're verified only by `pnpm build` (TypeScript + Next.js bundling of the worker via `new Worker(new URL(...))`). What this leaves unverified, and would need manual or e2e (Playwright, real browser) testing: actual WebGPU availability/model download in a real browser, `CreateWebWorkerMLCEngine` wiring end-to-end, worker lifecycle/termination, and progress-callback UI behavior during model load.

## Import UI (Task 16)

`ImportDialog` (`src/components/import/ImportDialog.tsx`), opened from a "Import z URL" button on `/recipes/new`, drives the pipeline through a `stage` state machine: `idle` → `fetch` (POST `/api/import/fetch`, a server route that runs `fetchPage` + `cleanHtml` to dodge CORS) → `model` (`ensureEngineReady()`, gated by `hasWebGpu()` — no WebGPU means an immediate error telling the user to configure the planned Gemini fallback) → `extract` (`extractWithWebLlm(markdown)`) → `done`, calling `onExtracted(recipe)` with the parsed `RecipeJsonLd`. Any thrown error at any stage moves to an `error` stage and shows the message inline.

`/recipes/new` (`src/app/(app)/recipes/new/page.tsx`) is a client component holding `showImport` and `extracted` state: while `extracted` is null it renders `RecipeForm` plus the import button/dialog; once `ImportDialog` calls back with extracted data, the page swaps to `ImportReviewForm` instead.

`ImportReviewForm` (`src/components/import/ImportReviewForm.tsx`) lets the user edit the extracted name/servings/steps, but **does not** auto-match or auto-create ingredients from the extracted `recipeIngredient` strings — those are only shown as a read-only reference list. The user must manually re-add each ingredient through `IngredientPicker` (search-and-select against the ingredient database), building up the `ingredients` array from scratch before saving via `POST /api/recipes`.
