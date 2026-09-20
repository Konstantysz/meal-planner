'use client';
import { useState } from 'react';
import { ensureEngineReady, extractWithWebLlm, hasWebGpu } from '@/lib/import/engine';
import type { RecipeJsonLd } from '@/lib/schemas';

export function ImportDialog({
  onClose, onExtracted,
}: { onClose: () => void; onExtracted: (r: RecipeJsonLd, url: string) => void }) {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<'idle' | 'fetch' | 'model' | 'extract' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<{ text: string; progress: number } | null>(null);

  async function extractOnServer(markdown: string) {
    setStage('extract');
    const er = await fetch('/api/import/extract', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    });
    if (!er.ok) throw new Error((await er.json()).error ?? 'extract failed');
    const recipe = await er.json();
    setStage('done');
    onExtracted(recipe, url);
  }

  async function run() {
    setError(null);
    setModelProgress(null);
    try {
      setStage('fetch');
      const fr = await fetch('/api/import/fetch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!fr.ok) throw new Error((await fr.json()).error ?? 'fetch failed');
      const { markdown } = await fr.json();

      if (!(await hasWebGpu())) {
        await extractOnServer(markdown);
        return;
      }

      setStage('model');
      try {
        await ensureEngineReady((p) => {
          setModelProgress({ text: p.text, progress: p.progress });
        });
      } catch (e) {
        console.error('WebGPU/Gemma init failed, falling back to server extraction:', e);
        await extractOnServer(markdown);
        return;
      }

      setStage('extract');
      const recipe = await extractWithWebLlm(markdown);
      setStage('done');
      onExtracted(recipe, url);
    } catch (e) {
      setError(String(e));
      setStage('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Import przepisu z URL</h3>
        <input
          value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.jadlonomia.com/..." type="url"
          className="w-full border rounded px-3 py-2 mb-3"
        />
        <div className="text-sm text-gray-600 mb-2">
          {stage === 'fetch' && 'Pobieram stronę…'}
          {stage === 'model' && (modelProgress?.text ?? 'Ładuję model (pierwszy raz może potrwać kilka minut)…')}
          {stage === 'extract' && 'Wyciągam przepis…'}
          {stage === 'done' && 'Gotowe'}
        </div>
        {stage === 'model' && modelProgress && (
          <div className="w-full h-2 bg-gray-200 rounded mb-2 overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all"
              style={{ width: `${Math.round(modelProgress.progress * 100)}%` }}
            />
          </div>
        )}
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1">Anuluj</button>
          <button onClick={run} disabled={!url || stage !== 'idle' && stage !== 'error' && stage !== 'done'}
            className="bg-green-600 text-white rounded px-3 py-1">
            Importuj
          </button>
        </div>
      </div>
    </div>
  );
}
