type AuthAction = 'login' | 'signup' | 'forgot' | 'reset';
type AuthErrorLike = { message?: string; status?: number; code?: string };

const GENERIC = 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';

/**
 * Maps a Supabase auth error to a fixed Polish message. Raw `error.message` is never shown:
 * it is English and, on signup, reveals whether an account exists ("User already registered").
 */
export function authErrorMessage(action: AuthAction, error: AuthErrorLike): string {
  if (error.status === 429 || error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit') {
    return 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.';
  }
  switch (action) {
    case 'login':
      return 'Nieprawidłowy e-mail lub hasło.';
    case 'signup':
      return 'Nie udało się utworzyć konta. Sprawdź dane i spróbuj ponownie.';
    case 'reset':
      return 'Nie udało się zapisać hasła. Link mógł wygasnąć — poproś o nowy.';
    default:
      return GENERIC;
  }
}
