/** An import failure whose message is already a readable Polish sentence for the user. */
export class ImportError extends Error {}

const GENERIC = 'Coś poszło nie tak. Spróbuj ponownie.';
const NETWORK = 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
const SESSION = 'Sesja wygasła. Zaloguj się ponownie.';

/** Reads `{ error }` from a failed API response without throwing on non-JSON bodies (e.g. a login page). */
export async function readApiError(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    const error = (body as { error?: unknown } | null)?.error;
    return typeof error === 'string' ? error : null;
  } catch {
    return null;
  }
}

/** Maps a failed `POST /api/import/fetch` (status + server message) to a Polish message. */
export function fetchFailureMessage(status: number, serverError: string | null): string {
  if (status === 401) return SESSION;
  if (status === 400) return 'Podaj poprawny adres strony z przepisem.';
  // The route reports upstream failures as "Error: Fetch failed: <status>" (see `fetchPage`).
  const upstream = /Fetch failed: (\d{3})/.exec(serverError ?? '')?.[1];
  if (upstream === '404' || upstream === '410') return 'Nie znaleziono takiej strony. Sprawdź adres.';
  if (upstream === '401' || upstream === '403') return 'Ta strona nie pozwala na pobranie przepisu.';
  if (upstream && upstream.startsWith('5')) return 'Strona z przepisem jest chwilowo niedostępna. Spróbuj później.';
  return 'Nie udało się pobrać strony. Sprawdź adres i spróbuj ponownie.';
}

/** Maps a failed `POST /api/import/extract` to a Polish message. The 503 text is already Polish (Ollama is down). */
export function extractFailureMessage(status: number, serverError: string | null): string {
  if (status === 401) return SESSION;
  if (status === 503 && serverError) return serverError;
  return 'Model nie odczytał przepisu z tej strony. Spróbuj ponownie lub dodaj przepis ręcznie.';
}

/** Turns anything thrown during an import into a message for the user; unknown failures stay generic. */
export function importErrorMessage(e: unknown): string {
  if (e instanceof ImportError) return e.message;
  // `fetch` rejects with a TypeError when the network is down.
  if (e instanceof TypeError) return NETWORK;
  return GENERIC;
}
