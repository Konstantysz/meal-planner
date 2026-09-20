'use client';
import { SYSTEM_PROMPT, parseLlmJson } from './schema';
import type { RecipeJsonLd } from '@/lib/schemas';

let worker: Worker | null = null;
let counter = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const { id, ok, text, error } = e.data;
    if (id == null) return;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    ok ? p.resolve(text) : p.reject(new Error(error));
  };
  return worker;
}

function call<T>(type: string, payload: unknown): Promise<T> {
  const w = getWorker();
  const id = ++counter;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ id, type, payload });
  });
}

export async function ensureEngineReady(onProgress?: (p: unknown) => void) {
  const w = getWorker();
  if (onProgress) {
    w.addEventListener('message', (e) => {
      if (e.data.type === 'progress') onProgress(e.data.progress);
    });
  }
  await call('init', null);
}

export async function extractWithWebLlm(markdown: string): Promise<RecipeJsonLd> {
  const raw = await call<string>('extract', { system: SYSTEM_PROMPT, user: markdown });
  return parseLlmJson(raw);
}

export function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}
