'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, ButtonLink, Input } from '@/components/ui';
import { AUTH_TITLE, Field, FormMessage } from './AuthFrame';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Same message whether or not the account exists, so the form can't be used to probe emails.
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className={AUTH_TITLE}>Nie pamiętam hasła</h1>
      {sent ? (
        <FormMessage tone="notice">
          Jeśli konto o takim adresie istnieje, wysłaliśmy na nie link do ustawienia nowego hasła.
        </FormMessage>
      ) : (
        <>
          <Field label="E-mail" htmlFor="forgot-email">
            <Input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? 'Chwileczkę…' : 'Wyślij link'}
          </Button>
        </>
      )}
      <p className="text-center text-sm">
        <ButtonLink href="/login" variant="link">
          Wróć do logowania
        </ButtonLink>
      </p>
    </form>
  );
}
