'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

/**
 * "Edytuj" for a recipe the user may not change: forks it (POST /api/recipes/[id]/fork) and opens
 * the fork's edit page. The original stays untouched.
 */
export function ForkEditButton({
  recipeId,
  label = 'Edytuj',
  primary = false,
}: {
  recipeId: string;
  label?: string;
  /** The screen's primary action (edit page) instead of a text link (recipe actions). */
  primary?: boolean;
}) {
  const router = useRouter();
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fork() {
    setForking(true);
    setError(null);
    const res = await fetch(`/api/recipes/${recipeId}/fork`, { method: 'POST' });
    const body: { id?: unknown; error?: unknown } = await res.json().catch(() => ({}));
    if (!res.ok || typeof body.id !== 'string') {
      setError(typeof body.error === 'string' ? body.error : 'Nie udało się skopiować przepisu');
      setForking(false);
      return;
    }
    router.push(`/recipes/${body.id}/edit`);
  }

  return (
    <>
      {primary ? (
        <Button variant="primary" onClick={fork} disabled={forking}>
          {forking ? 'Kopiuję…' : label}
        </Button>
      ) : (
        // Same look as the "Edytuj" link authors get in RecipeActions.
        <button
          type="button"
          onClick={fork}
          disabled={forking}
          title="Przepis innego domownika: edytujesz własną kopię, oryginał zostaje bez zmian"
          className="text-sm underline opacity-80 hover:opacity-100 disabled:opacity-50"
        >
          {forking ? 'Kopiuję…' : label}
        </button>
      )}
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
    </>
  );
}
