import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ImportError,
  extractFailureMessage,
  fetchFailureMessage,
  importErrorMessage,
  importFetch,
  readApiError,
} from '@/lib/import/errors';

describe('fetchFailureMessage', () => {
  it.each([
    [400, 'url required', /poprawny adres/],
    [401, null, /Sesja wygasła/],
    [500, 'Error: Fetch failed: 404', /Nie znaleziono/],
    [500, 'Error: Fetch failed: 403', /nie pozwala/],
    [500, 'Error: Fetch failed: 503', /chwilowo niedostępna/],
    [500, 'TypeError: fetch failed', /Nie udało się pobrać strony/],
    [500, null, /Nie udało się pobrać strony/],
  ])('maps %s %s', (status, server, expected) => {
    expect(fetchFailureMessage(status, server)).toMatch(expected);
  });
});

describe('extractFailureMessage', () => {
  it('passes the Polish Ollama-down message through', () => {
    expect(extractFailureMessage(503, 'Ollama nie działa.')).toBe('Ollama nie działa.');
  });
  it('hides raw errors behind a generic extraction message', () => {
    const m = extractFailureMessage(502, 'Error: ZodError ...');
    expect(m).toMatch(/Model nie odczytał/);
    expect(m).not.toMatch(/Zod/);
  });
  it('reports an expired session', () => {
    expect(extractFailureMessage(401, null)).toMatch(/Sesja wygasła/);
  });
});

describe('importErrorMessage', () => {
  it('keeps ImportError messages', () => {
    expect(importErrorMessage(new ImportError('Gotowe po polsku'))).toBe('Gotowe po polsku');
  });
  it('does not treat a stray TypeError as a network failure', () => {
    expect(importErrorMessage(new TypeError('x is undefined'))).toBe('Coś poszło nie tak. Spróbuj ponownie.');
  });
  it('keeps unknown errors generic', () => {
    expect(importErrorMessage(new Error('Device was lost'))).toBe('Coś poszło nie tak. Spróbuj ponownie.');
  });
});

describe('readApiError', () => {
  it('reads the error string', async () => {
    expect(await readApiError(new Response(JSON.stringify({ error: 'x' }), { status: 500 }))).toBe('x');
  });
  it('returns null for non-JSON bodies and non-string errors', async () => {
    expect(await readApiError(new Response('<html>', { status: 500 }))).toBeNull();
    expect(await readApiError(new Response(JSON.stringify({ error: { a: 1 } })))).toBeNull();
  });
});

describe('importFetch', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('maps a rejected fetch to a connection message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await importFetch('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImportError);
    expect(importErrorMessage(err)).toMatch(/Brak połączenia/);
  });
  it('lets aborts pass through', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(importFetch('/x')).rejects.toBe(abort);
  });
});
