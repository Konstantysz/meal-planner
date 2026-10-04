import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const engine = vi.hoisted(() => ({
  hasWebGpu: vi.fn(),
  ensureEngineReady: vi.fn(),
  extractWithWebLlm: vi.fn(),
}));
vi.mock('@/lib/import/engine', () => engine);

import { ImportDialog } from '@/components/import/ImportDialog';

const RECIPE = { name: 'Zupa', recipeIngredient: ['a'], recipeInstructions: ['b'] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Routes fetch by "METHOD path"; mode is what GET /api/import/extract reports. */
function stubFetch(mode: Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    if (key === 'POST /api/import/fetch') return json({ markdown: '# Zupa' });
    if (key === 'GET /api/import/extract') return mode;
    if (key === 'POST /api/import/extract') return json(RECIPE);
    throw new Error(`unexpected fetch ${key}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function runImport() {
  const onExtracted = vi.fn();
  render(<ImportDialog onClose={() => {}} onExtracted={onExtracted} />);
  await userEvent.type(screen.getByPlaceholderText(/jadlonomia/), 'https://a.pl/x');
  await userEvent.click(screen.getByRole('button', { name: /importuj/i }));
  return onExtracted;
}

const calledExtractPost = (f: ReturnType<typeof stubFetch>) =>
  f.mock.calls.some(([url, init]) => url === '/api/import/extract' && init?.method === 'POST');

beforeEach(() => Object.values(engine).forEach((m) => m.mockReset()));
afterEach(() => vi.unstubAllGlobals());

describe('ImportDialog', () => {
  it('server mode: extracts on the server and never touches WebLLM', async () => {
    const f = stubFetch(json({ mode: 'server' }));
    const onExtracted = await runImport();

    await waitFor(() => expect(onExtracted).toHaveBeenCalledWith(RECIPE, 'https://a.pl/x'));
    expect(calledExtractPost(f)).toBe(true);
    expect(engine.hasWebGpu).not.toHaveBeenCalled();
    expect(engine.extractWithWebLlm).not.toHaveBeenCalled();
  });

  it('browser mode: extracts with WebLLM', async () => {
    const f = stubFetch(json({ mode: 'browser' }));
    engine.hasWebGpu.mockResolvedValue(true);
    engine.extractWithWebLlm.mockResolvedValue(RECIPE);
    const onExtracted = await runImport();

    await waitFor(() => expect(onExtracted).toHaveBeenCalledWith(RECIPE, 'https://a.pl/x'));
    expect(engine.extractWithWebLlm).toHaveBeenCalledWith('# Zupa');
    expect(calledExtractPost(f)).toBe(false);
  });

  it('browser mode without WebGPU: shows an error, no server fallback', async () => {
    const f = stubFetch(json({ mode: 'browser' }));
    engine.hasWebGpu.mockResolvedValue(false);
    const onExtracted = await runImport();

    expect(await screen.findByText(/nie obsługuje WebGPU/)).toBeInTheDocument();
    expect(calledExtractPost(f)).toBe(false);
    expect(onExtracted).not.toHaveBeenCalled();
  });

  it('browser mode, WebLLM fails: shows the error, no server fallback', async () => {
    const f = stubFetch(json({ mode: 'browser' }));
    engine.hasWebGpu.mockResolvedValue(true);
    engine.extractWithWebLlm.mockRejectedValue(new Error('Device was lost'));
    await runImport();

    expect(await screen.findByText(/Device was lost/)).toBeInTheDocument();
    expect(calledExtractPost(f)).toBe(false);
  });

  it('shows an error when the mode cannot be read (e.g. expired session)', async () => {
    stubFetch(new Response('<html>login</html>', { status: 500 }));
    await runImport();
    expect(await screen.findByText(/odczytać trybu LLM \(500\)/)).toBeInTheDocument();
  });
});
