'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
    <form onSubmit={submit} className="space-y-4 max-w-sm mx-auto mt-20">
      <h1 className="text-2xl font-bold">Nie pamiętam hasła</h1>
      {sent ? (
        <p className="text-green-600 text-sm">
          Jeśli konto o takim adresie istnieje, wysłaliśmy na nie link do ustawienia nowego hasła.
        </p>
      ) : (
        <>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            className="w-full border rounded px-3 py-2"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white rounded py-2">
            {loading ? '...' : 'Wyślij link'}
          </button>
        </>
      )}
      <Link href="/login" className="block text-center text-sm text-green-700 underline">
        Wróć do logowania
      </Link>
    </form>
  );
}
