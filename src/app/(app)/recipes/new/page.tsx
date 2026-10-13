'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RecipeForm } from '@/components/recipes/RecipeForm';
import { ImportDialog } from '@/components/import/ImportDialog';
import { ImportReviewForm } from '@/components/import/ImportReviewForm';
import { Button } from '@/components/ui';
import type { ExtractedRecipe } from '@/lib/import/schema';

function NewRecipe() {
  const router = useRouter();
  const [showImport, setShowImport] = useState(useSearchParams().get('import') === '1');
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
    <div className="p-4">
      <div className="mx-auto mb-4 flex max-w-2xl items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-extrabold tracking-tight lg:text-4xl">Nowy przepis</h1>
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

export default function NewRecipePage() {
  return (
    <Suspense>
      <NewRecipe />
    </Suspense>
  );
}
