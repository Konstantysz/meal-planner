import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLM_OUTPUT_SCHEMA } from '@/lib/import/schema';

const create = vi.fn();
vi.mock('@mlc-ai/web-llm', () => ({
  CreateWebWorkerMLCEngine: vi.fn(async () => ({ chat: { completions: { create } } })),
}));

const terminate = vi.fn();
vi.stubGlobal(
  'Worker',
  class {
    terminate = terminate;
  },
);

// engine.ts keeps the engine in module state — fresh module per test.
async function loadEngine() {
  vi.resetModules();
  const engine = await import('@/lib/import/engine');
  await engine.ensureEngineReady();
  return engine;
}

const reply = (content: string, finish_reason = 'stop') => ({ choices: [{ message: { content }, finish_reason }] });

beforeEach(() => {
  create.mockReset();
  terminate.mockReset();
});

describe('extractWithWebLlm', () => {
  it('decodes with the output-schema grammar and passes markdown as-is', async () => {
    const { extractWithWebLlm } = await loadEngine();
    create.mockResolvedValue(reply('{"name":"Zupa","recipeIngredient":["a"],"recipeInstructions":["b"]}'));

    const r = await extractWithWebLlm('# Zupa');

    expect(r.name).toBe('Zupa');
    const req = create.mock.calls[0][0];
    expect(req.response_format).toEqual({ type: 'json_object', schema: JSON.stringify(LLM_OUTPUT_SCHEMA) });
    expect(req.messages[1]).toEqual({ role: 'user', content: '# Zupa' });
  });

  it('terminates the worker and requires re-init after an inference error (e.g. GPU device lost)', async () => {
    const { extractWithWebLlm } = await loadEngine();
    create.mockRejectedValue(new Error('Device was lost'));

    await expect(extractWithWebLlm('x')).rejects.toThrow('Device was lost');
    expect(terminate).toHaveBeenCalledOnce();
    await expect(extractWithWebLlm('x')).rejects.toThrow('engine not initialized');
  });

  it('throws a clear error when the output was cut at max_tokens', async () => {
    const { extractWithWebLlm } = await loadEngine();
    create.mockResolvedValue(reply('{"name":"Zu', 'length'));
    await expect(extractWithWebLlm('x')).rejects.toThrow(/ucięta/);
    expect(terminate).not.toHaveBeenCalled();
  });
});
