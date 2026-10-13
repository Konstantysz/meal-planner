'use client';
import { useState } from 'react';
import { Button, Input, Sheet } from '@/components/ui';
import { ensureEngineReady, extractWithWebLlm, hasWebGpu } from '@/lib/import/engine';
import {
  ImportError,
  extractFailureMessage,
  fetchFailureMessage,
  importErrorMessage,
  readApiError,
} from '@/lib/import/errors';
import type { ExtractedRecipe } from '@/lib/import/schema';

type Stage = 'idle' | 'fetch' | 'model' | 'extract' | 'done' | 'error';
type Step = 'fetch' | 'model' | 'extract';

const STEP_LABEL: Record<Step, string> = {
  fetch: 'Pobieram stronę',
  model: 'Ładuję model (pierwszy raz może potrwać kilka minut)',
  extract: 'Odczytuję przepis',
};

/** Steps the import goes through; the model step exists only in browser mode (WebLLM). */
function stepsFor(browserMode: boolean): Step[] {
  return browserMode ? ['fetch', 'model', 'extract'] : ['fetch', 'extract'];
}

export function ImportDialog({
  onClose,
  onExtracted,
}: {
  onClose: () => void;
  onExtracted: (r: ExtractedRecipe, url: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [browserMode, setBrowserMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelPercent, setModelPercent] = useState<number | null>(null);

  async function run() {
    setError(null);
    setModelPercent(null);
    setBrowserMode(false);
    try {
      setStage('fetch');
      const fr = await fetch('/api/import/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!fr.ok) throw new ImportError(fetchFailureMessage(fr.status, await readApiError(fr)));
      const { markdown } = (await fr.json()) as { markdown: string };

      // Modes are exclusive (Gemini fallback is paused): server → Ollama only, browser → WebLLM only.
      const mr = await fetch('/api/import/extract');
      if (!mr.ok) throw new ImportError(`Nie udało się odczytać trybu importu (${mr.status}). Spróbuj ponownie.`);
      const { mode } = await mr.json();
      let recipe: ExtractedRecipe;
      if (mode === 'server') {
        setStage('extract');
        const er = await fetch('/api/import/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown }),
        });
        if (!er.ok) throw new ImportError(extractFailureMessage(er.status, await readApiError(er)));
        recipe = await er.json();
      } else {
        setBrowserMode(true);
        if (!(await hasWebGpu())) {
          throw new ImportError(
            'Ta przeglądarka nie obsługuje WebGPU. Import działa tu tylko z serwerem uruchomionym z LLM_MODE=server.',
          );
        }
        setStage('model');
        await ensureEngineReady((p) => {
          setModelPercent(Math.round(p.progress * 100));
        });
        setStage('extract');
        try {
          recipe = await extractWithWebLlm(markdown);
        } catch {
          throw new ImportError(
            'Model w przeglądarce nie odczytał przepisu. Spróbuj ponownie lub dodaj przepis ręcznie.',
          );
        }
      }
      setStage('done');
      onExtracted(recipe, url);
    } catch (e) {
      setError(importErrorMessage(e));
      setStage('error');
    }
  }

  const busy = stage === 'fetch' || stage === 'model' || stage === 'extract';
  const canSubmit = !!url && !busy;
  const steps = stepsFor(browserMode);
  const current = steps.indexOf(stage as Step);

  return (
    <Sheet open onClose={onClose} title="Import przepisu z URL">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void run();
        }}
        className="space-y-4"
      >
        <label className="block space-y-1">
          <span className="text-sm text-muted">Adres strony z przepisem</span>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.jadlonomia.com/..."
            type="url"
            inputMode="url"
            autoFocus
            disabled={busy}
          />
        </label>
        <p className="text-xs text-muted">Obsługujemy m.in. jadlonomia.com i aniagotuje.pl.</p>
        {busy && (
          <ol role="status" aria-live="polite" className="space-y-2 border-t border-line pt-3 text-sm">
            {steps.map((s, i) => {
              const state = i < current ? 'done' : i === current ? 'active' : 'todo';
              return (
                <li key={s} className={state === 'todo' ? 'text-faint' : 'text-ink'} aria-current={state === 'active'}>
                  <span aria-hidden="true" className="mr-2 inline-block w-4 text-center">
                    {state === 'done' ? '✓' : state === 'active' ? '…' : '·'}
                  </span>
                  {STEP_LABEL[s]}
                  {state === 'active' && s === 'model' && modelPercent !== null && (
                    <span className="tabular-nums"> — {modelPercent}%</span>
                  )}
                  {state === 'active' && s === 'model' && modelPercent !== null && (
                    <div
                      role="progressbar"
                      aria-label="Postęp ładowania modelu"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={modelPercent}
                      className="mt-1 h-1 w-full overflow-hidden rounded-block bg-hover"
                    >
                      <div className="h-full bg-ink transition-all" style={{ width: `${modelPercent}%` }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {error && (
          <p role="alert" className="rounded-control border border-brand px-3 py-2 text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={onClose} className="flex-1 lg:flex-none">
            Anuluj
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit} className="flex-1 lg:flex-none">
            {stage === 'error' ? 'Spróbuj ponownie' : 'Importuj'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
