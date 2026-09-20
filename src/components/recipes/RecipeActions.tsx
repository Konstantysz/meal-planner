'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function RecipeActions({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    if (!confirm('Na pewno usunąć ten przepis?')) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Nie udało się usunąć przepisu');
      setDeleting(false);
      return;
    }
    router.push('/recipes');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Link href={`/recipes/${recipeId}/edit`} className="text-sm underline opacity-80 hover:opacity-100">
        Edytuj
      </Link>
      <button
        type="button" onClick={del} disabled={deleting}
        className="text-sm text-red-600 underline disabled:opacity-50"
      >
        {deleting ? 'Usuwam…' : 'Usuń'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
