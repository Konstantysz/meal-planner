'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui';
import { ForkEditButton } from './ForkEditButton';

/**
 * Edit and delete for a recipe. `canEdit` (author or app admin, see `canEditRecipe`) edits in place
 * and allows delete; anyone else gets "Edytuj" that forks the recipe first, and no delete.
 */
export function RecipeActions({ recipeId, canEdit }: { recipeId: string; canEdit: boolean }) {
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

  if (!canEdit) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ForkEditButton recipeId={recipeId} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonLink href={`/recipes/${recipeId}/edit`}>Edytuj</ButtonLink>
      <Button variant="link" onClick={del} disabled={deleting}>
        {deleting ? 'Usuwam…' : 'Usuń'}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-brand">
          {error}
        </span>
      )}
    </div>
  );
}
