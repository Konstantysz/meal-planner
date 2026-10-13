export type ImportStage = 'fetch' | 'mode' | 'model' | 'extract';

/** An error whose message is already a readable Polish sentence for the user. */
export class ImportError extends Error {}

const SESSION = 'Sesja wygasła. Zaloguj się ponownie i spróbuj jeszcze raz.';

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
  // The browser's fetch rejects with TypeError when the request never got an answer.
  if (e instanceof TypeError) return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
  if (stage === 'model') return 'Nie udało się załadować modelu w przeglądarce. Spróbuj ponownie.';
  if (stage === 'extract') return 'Model w przeglądarce nie zdołał odczytać przepisu. Spróbuj ponownie.';
  return 'Import się nie udał. Spróbuj ponownie.';
}
