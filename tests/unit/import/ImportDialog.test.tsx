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

    expect(await screen.findByText(/Model w przeglądarce nie odczytał przepisu/)).toBeInTheDocument();
    expect(screen.queryByText(/Device was lost/)).not.toBeInTheDocument();
    expect(calledExtractPost(f)).toBe(false);
  });

  it('shows an error when the mode cannot be read (e.g. expired session)', async () => {
    stubFetch(new Response('<html>login</html>', { status: 500 }));
    await runImport();
    expect(await screen.findByText(/odczytać trybu importu \(500\)/)).toBeInTheDocument();
  });

  it('maps a failed page fetch to a Polish message, not the raw server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'Error: Fetch failed: 404' }, 500)),
    );
    await runImport();
    expect(await screen.findByText('Nie znaleziono takiej strony. Sprawdź adres.')).toBeInTheDocument();
    expect(screen.queryByText(/Fetch failed/)).not.toBeInTheDocument();
  });

  it('maps a failed server extraction to a generic Polish message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const key = `${init?.method ?? 'GET'} ${url}`;
        if (key === 'POST /api/import/fetch') return json({ markdown: '# Zupa' });
        if (key === 'GET /api/import/extract') return json({ mode: 'server' });
        return json({ error: 'Error: ZodError: invalid' }, 502);
      }),
    );
    await runImport();
    expect(await screen.findByText(/Model nie odczytał przepisu/)).toBeInTheDocument();
    expect(screen.queryByText(/Zod/)).not.toBeInTheDocument();
  });

  it('shows a connection message when the network is down, and lets the user retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await runImport();
    expect(await screen.findByText(/Brak połączenia z serwerem/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeEnabled();
  });

  it('lists the steps while importing and highlights the current one', async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (release = resolve))),
    );
    await runImport();
    const step = await screen.findByText('Pobieram stronę');
    expect(step.closest('li')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Odczytuję przepis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importuj/i })).toBeDisabled();
    release(json({ markdown: '' }, 400));
    expect(await screen.findByText(/poprawny adres/)).toBeInTheDocument();
  });

  it('browser mode shows the model step with its percentage', async () => {
    stubFetch(json({ mode: 'browser' }));
    engine.hasWebGpu.mockResolvedValue(true);
    engine.ensureEngineReady.mockImplementation(async (cb: (p: { text: string; progress: number }) => void) => {
      cb({ text: 'Fetching param cache', progress: 0.42 });
      await new Promise(() => {});
    });
    await runImport();
    expect(await screen.findByText(/42%/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.queryByText(/Fetching param cache/)).not.toBeInTheDocument();
  });
});
