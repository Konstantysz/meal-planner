'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input } from '@/components/ui';
import { AUTH_TITLE, Field, FormMessage } from './AuthFrame';
import { authErrorMessage } from './auth-errors';

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(authErrorMessage('reset', error));
      return;
    }
    router.push('/recipes');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className={AUTH_TITLE}>Ustaw nowe hasło</h1>
      <Field label="Nowe hasło" htmlFor="reset-password">
        <Input
          id="reset-password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" variant="primary" disabled={loading} className="w-full">
        {loading ? 'Chwileczkę…' : 'Zapisz hasło'}
      </Button>
    </form>
  );
}
