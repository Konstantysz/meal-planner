'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, ButtonLink, Input } from '@/components/ui';
import { AUTH_TITLE, Field, FormMessage } from './AuthFrame';
import { useRouter } from 'next/navigation';

export function AuthForm({ mode, initialError }: { mode: 'login' | 'signup'; initialError?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push('/recipes');
      router.refresh();
      return;
    }

    // The household + owner membership is created by the on_auth_user_created
    // trigger (migration 0006), so it exists even when email confirmation is on.
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      // Email confirmation is on: no session until the link is clicked.
      setNotice('Sprawdź skrzynkę i kliknij link potwierdzający, a potem się zaloguj.');
      return;
    }
    router.push('/recipes');
    router.refresh();
  }

  const isLogin = mode === 'login';
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className={AUTH_TITLE}>{isLogin ? 'Zaloguj się' : 'Zarejestruj się'}</h1>
      <Field label="E-mail" htmlFor="auth-email">
        <Input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Hasło" htmlFor="auth-password">
        <Input
          id="auth-password"
          type="password"
          required
          minLength={isLogin ? undefined : 6}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {notice && <FormMessage tone="notice">{notice}</FormMessage>}
      <Button type="submit" variant="primary" disabled={loading} className="w-full">
        {loading ? 'Chwileczkę…' : isLogin ? 'Zaloguj' : 'Zarejestruj'}
      </Button>
      <div className="space-y-1 text-center text-sm text-muted">
        {isLogin ? (
          <>
            <p>
              Nie masz konta?{' '}
              <ButtonLink href="/signup" variant="link">
                Zarejestruj się
              </ButtonLink>
            </p>
            <p>
              <ButtonLink href="/forgot-password" variant="link">
                Nie pamiętam hasła
              </ButtonLink>
            </p>
          </>
        ) : (
          <p>
            Masz już konto?{' '}
            <ButtonLink href="/login" variant="link">
              Zaloguj się
            </ButtonLink>
          </p>
        )}
      </div>
    </form>
  );
}
