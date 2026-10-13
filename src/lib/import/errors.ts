/** `extract` is the server's extraction; `local` is the browser's (WebLLM) extraction. */
export type ImportStage = 'fetch' | 'mode' | 'model' | 'extract' | 'local';

/** An error whose message is already a readable Polish sentence for the user. */
export class ImportError extends Error {}

const SESSION = 'Sesja wygasła. Zaloguj się ponownie i spróbuj jeszcze raz.';

/**
 * True when fetch followed a redirect to the login page: an expired session answers `/api/*` with a 307 to
 * `/login`, which fetch follows into an HTML 200, so the status alone never says 401.
 */
export function isSessionRedirect(res: { redirected: boolean; url: string }): boolean {
  return res.redirected && new URL(res.url, 'http://localhost').pathname.startsWith('/login');
}

/** Polish message for a failed recipe save; the server's raw error text is never shown. */
export function saveStatusMessage(status: number): string {
  if (status === 401) return SESSION;
  if (status === 400) return 'Sprawdź dane przepisu (nazwę, porcje, składniki, kroki) i spróbuj ponownie.';
  return 'Nie udało się zapisać przepisu. Spróbuj ponownie.';
}

/** Polish message for a non-2xx answer of an import route; the server's raw error text is never shown. */
export function importStatusMessage(stage: ImportStage, status: number): string {
  if (status === 401) return SESSION;
  switch (stage) {
    case 'fetch':
      return status === 400
        ? 'Wpisz poprawny adres strony z przepisem.'
        : 'Nie udało się pobrać strony. Sprawdź adres i spróbuj ponownie.';
    case 'mode':
      return 'Nie udało się sprawdzić trybu importu. Odśwież stronę i spróbuj ponownie.';
    default:
      return status === 503
        ? 'Ollama nie działa. Uruchom ją (aplikacja Ollama lub `ollama serve`) i spróbuj ponownie.'
        : 'Nie udało się odczytać przepisu z tej strony. Spróbuj inny adres albo ponów próbę.';
  }
}

/** Polish message for anything thrown while importing; `stage` is where it happened. */
export function importErrorMessage(e: unknown, stage: ImportStage): string {
  if (e instanceof ImportError) return e.message;
  // The browser's fetch rejects with TypeError when the request never got an answer. WebLLM failures are
  // not network problems, so only the server stages map to it.
  if (e instanceof TypeError && (stage === 'fetch' || stage === 'mode' || stage === 'extract'))
    return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
  if (stage === 'model') return 'Nie udało się załadować modelu w przeglądarce. Spróbuj ponownie.';
  if (stage === 'local') return 'Model w przeglądarce nie zdołał odczytać przepisu. Spróbuj ponownie.';
  return 'Import się nie udał. Spróbuj ponownie.';
}
