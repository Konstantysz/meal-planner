'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { weekStartOf } from '@/lib/week';
import { Button, Input } from '@/components/ui';

export default function SettingsPage() {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateShare() {
    setLoading(true);
    setError(null);
    // Plan bieżącego tygodnia (poniedziałek, czas lokalny), tak jak na /plan
    const week = weekStartOf(new Date());
    const r = await fetch('/api/plans?week=' + week);
    if (!r.ok) {
      setError('Nie udało się wygenerować linku. Spróbuj ponownie.');
      setLoading(false);
      return;
    }
    const plan = await r.json();
    const tr = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: plan.id }),
    });
    if (tr.ok) {
      const { token } = await tr.json();
      setShareUrl(`${window.location.origin}/share/${token}`);
    } else {
      setError('Nie udało się wygenerować linku. Spróbuj ponownie.');
    }
    setLoading(false);
  }

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 lg:px-8 lg:py-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Ustawienia</h1>
      <section className="space-y-3 border-t border-line pt-4">
        <h2 className="font-display text-lg font-semibold">Udostępnij plan</h2>
        <p className="text-sm text-muted">Link pokazuje plan bieżącego tygodnia każdemu, kto go dostanie.</p>
        <Button variant="primary" onClick={generateShare} disabled={loading}>
          {loading ? 'Generuję…' : 'Wygeneruj link'}
        </Button>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        {shareUrl && (
          <div className="space-y-1">
            <label htmlFor="share-url" className="block text-sm font-medium">
              Link do planu
            </label>
            <Input id="share-url" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>
        )}
      </section>
      <section className="space-y-2 border-t border-line pt-4">
        <h2 className="font-display text-lg font-semibold">Zaproś do gospodarstwa</h2>
        <p className="text-sm text-muted">
          Zapraszanie po e-mailu nie jest jeszcze wspierane — zaproszona osoba musi już mieć konto i zostać dodana
          ręcznie (user_id).
        </p>
      </section>
      <section className="border-t border-line pt-4">
        <Button onClick={logout}>Wyloguj</Button>
      </section>
    </div>
  );
}
