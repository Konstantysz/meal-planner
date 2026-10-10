import { describe, it, expect, vi, afterEach } from 'vitest';

const callOllama = vi.fn();
vi.mock('@/lib/import/ollama', () => ({ callOllama }));

const { GET, POST } = await import('@/app/api/import/extract/route');

const post = (body: unknown) =>
  POST(new Request('http://x/api/import/extract', { method: 'POST', body: JSON.stringify(body) }));

afterEach(() => {
  vi.unstubAllEnvs();
  callOllama.mockReset();
});

describe('GET /api/import/extract', () => {
  it('reports server mode only for LLM_MODE=server', async () => {
    vi.stubEnv('LLM_MODE', 'server');
    expect(await GET().json()).toEqual({ mode: 'server' });
    vi.stubEnv('LLM_MODE', 'other');
    expect(await GET().json()).toEqual({ mode: 'browser' });
  });
});

describe('POST /api/import/extract', () => {
  it('rejects a missing markdown with 400', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(callOllama).not.toHaveBeenCalled();
  });

  it('extracts via Ollama', async () => {
    callOllama.mockResolvedValue(
      '{"name":"Zupa","recipeIngredient":[{"name":"a","amount":null,"unit":null,"optional":false}],"recipeInstructions":["b"]}',
    );
    const res = await post({ markdown: '# Zupa' });
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('Zupa');
    expect(callOllama.mock.calls[0][1]).toContain('# Zupa');
  });

  it('returns 503 with a hint when Ollama is not running', async () => {
    callOllama.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }));
    const res = await post({ markdown: '# Zupa' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Ollama nie działa/);
  });

  it('returns 502 with the error when Ollama fails', async () => {
    callOllama.mockRejectedValue(new Error('Ollama 404: model not found'));
    const res = await post({ markdown: '# Zupa' });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/model not found/);
  });
});
