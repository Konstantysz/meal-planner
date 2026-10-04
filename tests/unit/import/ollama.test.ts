import { describe, it, expect, vi, afterEach } from 'vitest';
import { callOllama } from '@/lib/import/ollama';
import { LLM_OUTPUT_SCHEMA } from '@/lib/import/schema';

afterEach(() => vi.unstubAllGlobals());

describe('callOllama', () => {
  it('posts system+user to /api/chat in JSON mode and returns message content', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: { content: '{"name":"Zupa"}' } }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await callOllama('sys', 'usr');

    expect(out).toBe('{"name":"Zupa"}');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'gemma2:2b',
      stream: false,
      format: LLM_OUTPUT_SCHEMA,
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'usr' }],
    });
  });

  it('throws with status on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('model not found', { status: 404 })));
    await expect(callOllama('s', 'u')).rejects.toThrow(/Ollama 404: model not found/);
  });
});
