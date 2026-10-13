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
  /** The screen's primary action (edit page) instead of an outline button (recipe actions). */
  primary?: boolean;
}) {
  const router = useRouter();
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fork() {
    setForking(true);
    setError(null);
    let forkId: string | null = null;
    try {
      const res = await fetch(`/api/recipes/${recipeId}/fork`, { method: 'POST' });
      const body: { id?: unknown; error?: unknown } = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.id !== 'string') {
        setError(typeof body.error === 'string' ? body.error : 'Nie udało się skopiować przepisu');
        return;
      }
      forkId = body.id;
    } catch {
      // Network failure: fetch rejected before any response.
      setError('Nie udało się utworzyć kopii. Spróbuj ponownie.');
    } finally {
      // Stay disabled only while navigating to the fork.
      if (forkId === null) setForking(false);
    }
    if (forkId !== null) router.push(`/recipes/${forkId}/edit`);
  }

  return (
    <>
      <Button
        variant={primary ? 'primary' : 'outline'}
        onClick={fork}
        disabled={forking}
        // Same look as the "Edytuj" link authors get in RecipeActions (outline) unless primary.
        title={primary ? undefined : 'Przepis innego domownika: edytujesz własną kopię, oryginał zostaje bez zmian'}
      >
        {forking ? 'Kopiuję…' : label}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-brand">
          {error}
        </span>
      )}
    </>
  );
}
