'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
      setError(error.message);
      return;
    }
    router.push('/recipes');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-sm mx-auto mt-20">
      <h1 className="text-2xl font-bold">Ustaw nowe hasło</h1>
      <input
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="nowe hasło"
        className="w-full border rounded px-3 py-2"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="w-full bg-green-600 text-white rounded py-2">
        {loading ? '...' : 'Zapisz hasło'}
      </button>
    </form>
  );
}
