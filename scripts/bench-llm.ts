/**
 * Browser (WebLLM) vs server (Ollama) extraction benchmark on 10 live recipe pages.
 * Both paths get the same cleaned markdown and the same retry logic (extractRecipe in Node);
 * only the LlmFn differs. Reports single-page cold time and amortized time over all pages.
 *
 * Needs: running Ollama with `gemma2:2b`, installed Google Chrome with WebGPU.
 * First browser run downloads the model (~1.5 GB) into .bench-chrome/ — reported separately.
 *
 * Usage: pnpm bench:llm [server|browser|both=both]
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { fetchPage } from '../src/lib/import/fetch';
import { cleanHtml } from '../src/lib/import/clean';
import { extractRecipe, type LlmFn } from '../src/lib/import/extract';
import { callOllama, OLLAMA_MODEL } from '../src/lib/import/ollama';
import { SYSTEM_PROMPT, LLM_OUTPUT_SCHEMA } from '../src/lib/import/schema';

const URLS = [
  'https://aniagotuje.pl/przepis/zupa-pomidorowa',
  'https://aniagotuje.pl/przepis/grzyby-w-smietanie',
  'https://aniagotuje.pl/przepis/surowka-z-czerwonej-kapusty',
  'https://aniagotuje.pl/przepis/watrobka-drobiowa',
  'https://aniagotuje.pl/przepis/zupa-meksykanska',
  'https://jadlonomia.com/przepisy/dyniowa-pomidorowa/',
  'https://jadlonomia.com/przepisy/bob-tofu-po-koreansku/',
  'https://jadlonomia.com/przepisy/briam-greckie-pieczone-warzywa/',
  'https://jadlonomia.com/przepisy/focaccia-rewolucyjna/',
  'https://jadlonomia.com/przepisy/leczo-z-kurkami/',
];
// Same model as engine.ts; WebLLM pinned to the app's installed version.
const WEBLLM_MODEL = 'gemma-2-2b-it-q4f16_1-MLC';
const WEBLLM_ESM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
const ORIGIN = 'https://bench.local/'; // intercepted; gives a secure context for Cache API + WebGPU

type Row = { page: string; ms: number; calls: number; ok: boolean; ingredients: number; steps: number; error?: string };
type Result = { name: string; loadMs: number; rows: Row[] };

async function runPages(
  name: string,
  pages: { url: string; md: string }[],
  llm: () => LlmFn,
  loadMs: number,
): Promise<Result> {
  const rows: Row[] = [];
  for (const { url, md } of pages) {
    let calls = 0;
    const inner = llm();
    const counted: LlmFn = (s, u) => {
      calls++;
      return inner(s, u);
    };
    const t0 = performance.now();
    let ok = true,
      ingredients = 0,
      steps = 0,
      error: string | undefined;
    try {
      const r = await extractRecipe(md, counted, SYSTEM_PROMPT, 2);
      ingredients = r.recipeIngredient?.length ?? 0;
      steps = r.recipeInstructions?.length ?? 0;
    } catch (e) {
      ok = false;
      error = String(e).replace(/\s+/g, ' ').slice(0, 300);
    }
    rows.push({
      page: url.split('/').filter(Boolean).at(-1)!,
      ms: Math.round(performance.now() - t0),
      calls,
      ok,
      ingredients,
      steps,
    });
    console.log(
      `  [${name}] ${rows.at(-1)!.page}: ${rows.at(-1)!.ms} ms, calls ${calls}, ok ${ok}${error ? `\n    ${error}` : ''}`,
    );
  }
  return { name, loadMs, rows };
}

async function benchServer(pages: { url: string; md: string }[]): Promise<Result> {
  execSync(`ollama stop ${OLLAMA_MODEL}`); // force cold start
  const t0 = performance.now();
  await callOllama('Odpowiedz JSON.', '{}'); // loads model into VRAM
  const loadMs = Math.round(performance.now() - t0);
  return runPages('server', pages, () => callOllama, loadMs);
}

async function benchBrowser(pages: { url: string; md: string }[]): Promise<Result> {
  execSync(`ollama stop ${OLLAMA_MODEL}`); // free VRAM for the browser
  const ctx = await chromium.launchPersistentContext(resolve('.bench-chrome'), {
    channel: 'chrome',
    headless: process.env.HEADED !== '1',
    args: ['--enable-unsafe-webgpu'],
  });
  try {
    const page = await ctx.newPage();
    page.on('requestfailed', (r) => console.error(`  request failed: ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', (r) => {
      if (r.status() >= 400) console.error(`  HTTP ${r.status()}: ${r.url()}`);
    });
    await page.route(ORIGIN, (r) =>
      r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>bench</title>' }),
    );
    await page.goto(ORIGIN);
    const hasGpu = await page.evaluate(
      async () =>
        !!(await (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()),
    );
    if (!hasGpu) throw new Error('No WebGPU adapter in Chrome (try HEADED=1)');

    const t0 = performance.now();
    const downloaded = await initWebLlm(page);
    const loadMs = Math.round(performance.now() - t0);
    if (downloaded) {
      console.log(`  [browser] model downloaded in ${loadMs} ms — re-measuring load from cache`);
      await page.reload();
      const t1 = performance.now();
      await initWebLlm(page);
      return await runPages('browser', pages, () => browserLlm(page), Math.round(performance.now() - t1));
    }
    return await runPages('browser', pages, () => browserLlm(page), loadMs);
  } finally {
    await ctx.close();
  }
}

/** Loads WebLLM in the page; returns true if the model had to be downloaded (not cached). */
function initWebLlm(page: Page): Promise<boolean> {
  return page.evaluate(
    async ([esm, model]) => {
      const webllm = await import(esm);
      const w = window as unknown as Record<string, unknown>;
      const cached: boolean = await webllm.hasModelInCache(model);
      w.engine = await webllm.CreateMLCEngine(model);
      return !cached;
    },
    [WEBLLM_ESM, WEBLLM_MODEL] as const,
  );
}

/** Same request parameters as extractWithWebLlm in engine.ts. */
function browserLlm(page: Page): LlmFn {
  const schema = JSON.stringify(LLM_OUTPUT_SCHEMA);
  return (system, user) =>
    page.evaluate(
      async ([s, u, sch]) => {
        type Engine = {
          chat: { completions: { create(o: unknown): Promise<{ choices: { message?: { content?: string } }[] }> } };
        };
        const engine = (window as unknown as { engine: Engine }).engine;
        const r = await engine.chat.completions.create({
          messages: [
            { role: 'system', content: s },
            { role: 'user', content: u },
          ],
          temperature: 0.1,
          max_tokens: 1536,
          response_format: { type: 'json_object', schema: sch },
        });
        return r.choices[0]?.message?.content ?? '';
      },
      [system, user, schema] as const,
    );
}

function summarize({ name, loadMs, rows }: Result) {
  const total = rows.reduce((a, r) => a + r.ms, 0);
  const sorted = rows.map((r) => r.ms).sort((a, b) => a - b);
  return {
    path: name,
    'load ms': loadMs,
    'single page cold ms': loadMs + rows[0].ms,
    'amortized ms/page (10)': Math.round((loadMs + total) / rows.length),
    'warm p50 ms': sorted[Math.floor(sorted.length / 2)],
    'warm max ms': sorted.at(-1),
    ok: `${rows.filter((r) => r.ok).length}/${rows.length}`,
    retries: rows.reduce((a, r) => a + r.calls - 1, 0),
  };
}

async function main() {
  const which = process.argv[2] ?? 'both';
  const pages = await Promise.all(URLS.map(async (url) => ({ url, md: cleanHtml(await fetchPage(url)) })));
  console.log('markdown chars:', pages.map((p) => p.md.length).join(', '));

  const results: Result[] = [];
  if (which !== 'browser') results.push(await benchServer(pages));
  if (which !== 'server') results.push(await benchBrowser(pages));

  for (const r of results) {
    console.log(`\n${r.name}`);
    console.table(r.rows);
  }
  console.table(results.map(summarize));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
