import { LLM_OUTPUT_SCHEMA } from './schema';

// Same model family as the in-browser WebLLM path (gemma-2-2b), served by a local Ollama.
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma2:2b';
const BASE_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
// Cold start (model load into VRAM) + generation took ≤ 20 s in the benchmark; this only catches a hung Ollama.
const TIMEOUT_MS = 120_000;

export async function callOllama(system: string, user: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: LLM_OUTPUT_SCHEMA,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // Ollama's default ctx (2048) truncates longer recipe pages; gemma2 supports 8k.
      // num_predict matches the browser path's max_tokens (engine.ts).
      options: { temperature: 0.1, num_ctx: 8192, num_predict: 1536 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message?.content ?? '';
}
