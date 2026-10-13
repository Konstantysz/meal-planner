'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeForm } from '@/components/recipes/RecipeForm';
import { ImportDialog } from '@/components/import/ImportDialog';
import { ImportReviewForm } from '@/components/import/ImportReviewForm';
import { Button } from '@/components/ui';
import type { ExtractedRecipe } from '@/lib/import/schema';

/** The new-recipe page: the manual form, or the import review once a recipe has been extracted. */
export function NewRecipeScreen({ startWithImport = false }: { startWithImport?: boolean }) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(startWithImport);
  const [extracted, setExtracted] = useState<{ data: ExtractedRecipe; url: string } | null>(null);

  if (extracted) {
    return (
      <ImportReviewForm
        extracted={extracted.data}
        sourceUrl={extracted.url}
        onCancel={() => setExtracted(null)}
        onSaved={(id) => router.push(`/recipes/${id}`)}
      />
    );
  }

  return (
    <div>
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Nowy przepis</h1>
        <Button onClick={() => setShowImport(true)}>Import z URL</Button>
      </div>
      <RecipeForm />
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onExtracted={(data, url) => {
            setExtracted({ data, url });
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}
