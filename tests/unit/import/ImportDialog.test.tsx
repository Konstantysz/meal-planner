import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const engine = vi.hoisted(() => ({
  hasWebGpu: vi.fn(),
  ensureEngineReady: vi.fn(),
  extractWithWebLlm: vi.fn(),
}));
vi.mock('@/lib/import/engine', () => engine);

import { ImportDialog } from '@/components/import/ImportDialog';

const RECIPE = {
  name: 'Zupa',
  recipeIngredient: [{ name: 'a', amount: 1, unit: 'g', optional: false }],
  recipeInstructions: ['b'],
};
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

beforeAll(() => {
  // jsdom has no <dialog> behaviour; emulate open/close.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});
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

  it('submits on Enter in the URL field, like the button', async () => {
    const f = stubFetch(json({ mode: 'server' }));
    const onExtracted = vi.fn();
    render(<ImportDialog onClose={() => {}} onExtracted={onExtracted} />);
    await userEvent.type(screen.getByPlaceholderText(/jadlonomia/), 'https://a.pl/x{Enter}');

    await waitFor(() => expect(onExtracted).toHaveBeenCalledWith(RECIPE, 'https://a.pl/x'));
    expect(calledExtractPost(f)).toBe(true);
  });

  it('Enter with an empty URL does nothing', async () => {
    const f = stubFetch(json({ mode: 'server' }));
    render(<ImportDialog onClose={() => {}} onExtracted={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/jadlonomia/), '{Enter}');
    expect(f).not.toHaveBeenCalled();
  });

  it('Anuluj does not submit', async () => {
    const f = stubFetch(json({ mode: 'server' }));
    const onClose = vi.fn();
    render(<ImportDialog onClose={onClose} onExtracted={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/jadlonomia/), 'https://a.pl/x');
    await userEvent.click(screen.getByRole('button', { name: /anuluj/i }));
    expect(onClose).toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Model w przeglądarce nie zdołał odczytać przepisu');
    expect(screen.queryByText(/Device was lost/)).not.toBeInTheDocument();
    expect(calledExtractPost(f)).toBe(false);
  });

  it('shows an error when the mode cannot be read (e.g. expired session)', async () => {
    stubFetch(new Response('<html>login</html>', { status: 500 }));
    await runImport();
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się sprawdzić trybu importu');
  });

  it('fetch failure: Polish message, not the server error text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'Error: Fetch failed: 404' }, 500)),
    );
    await runImport();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Nie udało się pobrać strony');
    expect(alert).not.toHaveTextContent('Fetch failed');
    expect(screen.getByRole('button', { name: /spróbuj ponownie/i })).toBeEnabled();
  });

  it('extract failure on the server: Polish message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const key = `${init?.method ?? 'GET'} ${url}`;
        if (key === 'POST /api/import/fetch') return json({ markdown: '# Zupa' });
        if (key === 'GET /api/import/extract') return json({ mode: 'server' });
        return json({ error: 'Error: LLM failed to produce valid recipe: {...}' }, 502);
      }),
    );
    await runImport();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Nie udało się odczytać przepisu z tej strony');
    expect(alert).not.toHaveTextContent('LLM failed');
  });

  it('network failure: connection message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await runImport();
    expect(await screen.findByRole('alert')).toHaveTextContent('Brak połączenia z serwerem');
  });

  it('shows the steps while running', async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((res) => (release = res))),
    );
    await runImport();
    expect(screen.getByText(/1\. Pobieranie strony/)).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('status')).toHaveTextContent('Pobieram stronę');
    release(json({ markdown: '#' }, 500));
    await screen.findByRole('alert');
  });
});
