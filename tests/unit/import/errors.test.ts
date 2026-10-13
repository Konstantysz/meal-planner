import { describe, it, expect } from 'vitest';
import {
  ImportError,
  importErrorMessage,
  importStatusMessage,
  isSessionRedirect,
  saveStatusMessage,
} from '@/lib/import/errors';
import { summarizeOutcome } from '@/lib/import/match-outcome';

describe('importStatusMessage', () => {
  it('maps fetch statuses to Polish text', () => {
    expect(importStatusMessage('fetch', 400)).toMatch(/poprawny adres/);
    expect(importStatusMessage('fetch', 500)).toMatch(/pobrać strony/);
  });
  it('401 is a session message at any stage', () => {
    for (const s of ['fetch', 'mode', 'extract'] as const) expect(importStatusMessage(s, 401)).toMatch(/Sesja wygasła/);
  });
  it('extract: 503 means Ollama is down, others a read failure', () => {
    expect(importStatusMessage('extract', 503)).toMatch(/Ollama nie działa/);
    expect(importStatusMessage('extract', 502)).toMatch(/odczytać przepisu/);
  });
});

describe('importErrorMessage', () => {
  it('keeps the text of an ImportError', () => {
    expect(importErrorMessage(new ImportError('Gotowe zdanie.'), 'fetch')).toBe('Gotowe zdanie.');
  });
  it('never leaks the raw error', () => {
    for (const stage of ['fetch', 'mode', 'model', 'extract'] as const) {
      expect(importErrorMessage(new Error('Device was lost'), stage)).not.toMatch(/Device was lost/);
    }
  });
  it('TypeError is a connection problem', () => {
    expect(importErrorMessage(new TypeError('Failed to fetch'), 'fetch')).toMatch(/Brak połączenia/);
  });
  it('TypeError from WebLLM (model, local) is not a connection problem', () => {
    expect(importErrorMessage(new TypeError('x'), 'model')).toMatch(/załadować modelu/);
    expect(importErrorMessage(new TypeError('x'), 'local')).toMatch(/Model w przeglądarce/);
  });
  it('names the model stage', () => {
    expect(importErrorMessage(new Error('x'), 'model')).toMatch(/załadować modelu/);
  });
});

describe('isSessionRedirect', () => {
  it('is true only for a redirect that landed on /login', () => {
    expect(isSessionRedirect({ redirected: true, url: 'http://x.pl/login?next=/api/a' })).toBe(true);
    expect(isSessionRedirect({ redirected: true, url: 'http://x.pl/other' })).toBe(false);
    expect(isSessionRedirect({ redirected: false, url: 'http://x.pl/login' })).toBe(false);
  });
});

describe('saveStatusMessage', () => {
  it('maps statuses to Polish text', () => {
    expect(saveStatusMessage(401)).toMatch(/Sesja wygasła/);
    expect(saveStatusMessage(400)).toMatch(/Sprawdź dane/);
    expect(saveStatusMessage(500)).toMatch(/Nie udało się zapisać/);
  });
});

describe('summarizeOutcome', () => {
  it('counts rows per status', () => {
    const row = (status: 'matched' | 'created' | 'unmatched') => ({ text: 'a', status, ingredientName: null });
    expect(summarizeOutcome([row('matched'), row('matched'), row('created'), row('unmatched')])).toEqual({
      matched: 2,
      created: 1,
      unmatched: 1,
    });
    expect(summarizeOutcome([])).toEqual({ matched: 0, created: 0, unmatched: 0 });
  });
});
