/// <reference lib="webworker" />
import { CreateWebWorkerMLCEngine, type WebWorkerMLCEngine } from '@mlc-ai/web-llm';

let engine: WebWorkerMLCEngine | null = null;

const MODEL_ID = 'gemma-2-2b-it-q4f16_1-MLC';

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;
  try {
    if (type === 'init') {
      if (!engine) {
        engine = await CreateWebWorkerMLCEngine(self, MODEL_ID, {
          initProgressCallback: (p) => self.postMessage({ type: 'progress', progress: p }),
        });
      }
      self.postMessage({ id, ok: true });
      return;
    }
    if (type === 'extract') {
      if (!engine) throw new Error('engine not initialized');
      const chunks = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: payload.system },
          { role: 'user', content: payload.user },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      });
      self.postMessage({ id, ok: true, text: chunks.choices[0]?.message?.content ?? '' });
      return;
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
