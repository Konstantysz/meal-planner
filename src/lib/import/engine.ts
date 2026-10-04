'use client';
import { CreateWebWorkerMLCEngine, type WebWorkerMLCEngine, type InitProgressReport } from '@mlc-ai/web-llm';
import { SYSTEM_PROMPT, LLM_OUTPUT_SCHEMA, MAX_MARKDOWN_CHARS, parseLlmJson } from './schema';
import type { RecipeJsonLd } from '@/lib/schemas';

const MODEL_ID = 'gemma-2-2b-it-q4f16_1-MLC';
const INIT_TIMEOUT_MS = 10 * 60 * 1000;

let enginePromise: Promise<WebWorkerMLCEngine> | null = null;

export async function ensureEngineReady(onProgress?: (p: InitProgressReport) => void) {
  if (!enginePromise) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    enginePromise = CreateWebWorkerMLCEngine(worker, MODEL_ID, {
      initProgressCallback: onProgress,
    });
  }
  await Promise.race([
    enginePromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Ładowanie modelu trwa zbyt długo (timeout 10 min)')), INIT_TIMEOUT_MS)
    ),
  ]);
}

export async function extractWithWebLlm(markdown: string): Promise<RecipeJsonLd> {
  if (!enginePromise) throw new Error('engine not initialized');
  const engine = await enginePromise;
  const truncated = markdown.length > MAX_MARKDOWN_CHARS
    ? markdown.slice(0, MAX_MARKDOWN_CHARS)
    : markdown;
  let chunks;
  try {
    chunks = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: truncated },
      ],
      temperature: 0.1,
      max_tokens: 1536,
      response_format: { type: 'json_object', schema: JSON.stringify(LLM_OUTPUT_SCHEMA) },
    });
  } catch (e) {
    // GPU device can be lost mid-inference (driver crash/OOM) — the worker/engine
    // is dead at that point, so drop it and force re-init on the next attempt.
    enginePromise = null;
    throw e;
  }
  const choice = chunks.choices[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('Odpowiedź modelu została ucięta (za długi przepis). Spróbuj importu przez serwer.');
  }
  return parseLlmJson(choice?.message?.content ?? '');
}

export async function hasWebGpu(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
  try {
    const adapter = await (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
    return adapter != null;
  } catch (e) {
    console.error('WebGPU adapter request failed:', e);
    return false;
  }
}
