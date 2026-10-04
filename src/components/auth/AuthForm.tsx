'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
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

  return (
    <form onSubmit={submit} className="space-y-4 max-w-sm mx-auto mt-20">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}</h1>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        className="w-full border rounded px-3 py-2"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="hasło"
        className="w-full border rounded px-3 py-2"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {notice && <p className="text-green-600 text-sm">{notice}</p>}
      <button type="submit" disabled={loading} className="w-full bg-green-600 text-white rounded py-2">
        {loading ? '...' : mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
      </button>
      {mode === 'login' && (
        <Link href="/forgot-password" className="block text-center text-sm text-green-700 underline">
          Nie pamiętam hasła
        </Link>
      )}
    </form>
  );
}
