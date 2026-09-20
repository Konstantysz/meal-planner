'use client';
import { CreateWebWorkerMLCEngine, type WebWorkerMLCEngine, type InitProgressReport } from '@mlc-ai/web-llm';
import { SYSTEM_PROMPT, parseLlmJson } from './schema';
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

// Gemma-2-2b's context window is 4096 tokens shared across system + user + output.
// ~4 chars/token is a safe rule of thumb for Polish/English mixed text.
const MAX_MARKDOWN_CHARS = 6000;

export async function extractWithWebLlm(markdown: string): Promise<RecipeJsonLd> {
  if (!enginePromise) throw new Error('engine not initialized');
  const engine = await enginePromise;
  const truncated = markdown.length > MAX_MARKDOWN_CHARS
    ? markdown.slice(0, MAX_MARKDOWN_CHARS)
    : markdown;
  const chunks = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: truncated },
    ],
    temperature: 0.1,
    max_tokens: 1536,
  });
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
