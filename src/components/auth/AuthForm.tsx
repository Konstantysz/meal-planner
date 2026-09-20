'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setError(error.message); return; }
      router.push('/recipes');
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Utwórz gospodarstwo domowe dla nowego użytkownika, w przeciwnym razie
    // nie przejdzie kontroli is_member_of() w RLS na żadnej tabeli.
    // Wykonywane atomowo przez funkcję RPC (insert households + insert
    // household_members w jednej transakcji SECURITY DEFINER) — insert
    // households.insert().select().single() od klienta zawodził, bo
    // households_select wymaga is_member_of(), a wiersz household_members
    // jeszcze nie istniał w momencie odczytu.
    // ponytail: jeśli Supabase wymaga potwierdzenia e-maila, data.user?.id jest
    // dostępne, ale sesja jeszcze nie istnieje — RPC poniżej wymaga
    // auth.uid() z ważnej sesji, więc w takim wypadku się nie powiedzie;
    // gospodarstwo trzeba wtedy założyć po pierwszym logowaniu.
    const userId = data.user?.id;
    if (userId) {
      const householdName = email.split('@')[0] || 'Moje gospodarstwo';
      const { error: householdError } = await supabase.rpc('create_household_with_owner', {
        household_name: householdName,
      });

      if (householdError) {
        setLoading(false);
        setError(householdError.message);
        return;
      }
    }

    setLoading(false);
    router.push('/recipes');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-sm mx-auto mt-20">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}</h1>
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="email" className="w-full border rounded px-3 py-2"
      />
      <input
        type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="hasło" className="w-full border rounded px-3 py-2"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="w-full bg-green-600 text-white rounded py-2">
        {loading ? '...' : mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
      </button>
    </form>
  );
}
