'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeForm } from '@/components/recipes/RecipeForm';
import { ImportDialog } from '@/components/import/ImportDialog';
import { ImportReviewForm } from '@/components/import/ImportReviewForm';
import type { RecipeJsonLd } from '@/lib/schemas';

export default function NewRecipePage() {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [extracted, setExtracted] = useState<{ data: RecipeJsonLd; url: string } | null>(null);

  if (extracted) {
    return <ImportReviewForm
      extracted={extracted.data}
      sourceUrl={extracted.url}
      onCancel={() => setExtracted(null)}
      onSaved={(id) => router.push(`/recipes/${id}`)}
    />;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Nowy przepis</h1>
        <button onClick={() => setShowImport(true)} className="text-green-700 border border-green-700 rounded px-3 py-1">
          Import z URL
        </button>
      </div>
      <RecipeForm />
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onExtracted={(data) => {
        setExtracted({ data, url: '' });
        setShowImport(false);
      }} />}
    </div>
  );
}
