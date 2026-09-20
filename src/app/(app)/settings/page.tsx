'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateShare() {
    setLoading(true);
    // W v1: plan bieżącego tygodnia
    const week = new Date().toISOString().slice(0, 10);
    const r = await fetch('/api/plans?week=' + week);
    if (!r.ok) { setLoading(false); return; }
    const plan = await r.json();
    const tr = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: plan.id }),
    });
    if (tr.ok) {
      const { token } = await tr.json();
      setShareUrl(`${window.location.origin}/share/${token}`);
    }
    setLoading(false);
  }

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Ustawienia</h1>
      <section>
        <h2 className="font-semibold mb-2">Udostępnij plan</h2>
        <button onClick={generateShare} disabled={loading} className="bg-green-600 text-white rounded px-3 py-2">
          {loading ? '…' : 'Wygeneruj link'}
        </button>
        {shareUrl && (
          <div className="mt-2 text-sm break-all bg-gray-100 p-2 rounded">
            <a href={shareUrl}>{shareUrl}</a>
          </div>
        )}
      </section>
      <section>
        <h2 className="font-semibold mb-2">Zaproś do gospodarstwa</h2>
        <p className="text-sm text-gray-500">
          Zapraszanie po e-mailu nie jest jeszcze wspierane — zaproszona osoba musi już mieć konto i zostać dodana ręcznie (user_id).
        </p>
      </section>
      <button onClick={logout} className="text-red-600">Wyloguj</button>
    </div>
  );
}
