'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Sheet } from '@/components/ui';
import { ensureEngineReady, extractWithWebLlm, hasWebGpu } from '@/lib/import/engine';
import {
  ImportError,
  importErrorMessage,
  importStatusMessage,
  isSessionRedirect,
  type ImportStage,
} from '@/lib/import/errors';
import type { ExtractedRecipe } from '@/lib/import/schema';

type Stage = 'idle' | 'fetch' | 'model' | 'extract' | 'done' | 'error';
type Mode = 'server' | 'browser';

const STEP_LABEL = {
  fetch: 'Pobieranie strony',
  model: 'Ładowanie modelu',
  extract: 'Odczytywanie przepisu',
} as const;
type Step = keyof typeof STEP_LABEL;

/** Steps the run goes through; the model step exists only when the browser extracts. */
function stepsFor(mode: Mode | null): Step[] {
  return mode === 'browser' ? ['fetch', 'model', 'extract'] : ['fetch', 'extract'];
}

export function ImportDialog({
  onClose,
  onExtracted,
}: {
  onClose: () => void;
  onExtracted: (r: ExtractedRecipe, url: string, imageUrl: string | null) => void;
}) {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<{ text: string; progress: number } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Closing the dialog (Anuluj, Escape) must not let a running import open the review screen later.
  useEffect(() => () => abortRef.current?.abort(), []);

  // The input is disabled during a run, which drops focus to <body>; bring it back with the error.
  useEffect(() => {
    if (stage === 'error') formRef.current?.querySelector('input')?.focus();
  }, [stage]);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { signal } = ctrl;
    // fetch that turns an expired-session redirect into the session message
    const call = async (input: string, init: RequestInit | undefined, stage: ImportStage) => {
      const res = await fetch(input, { ...init, signal });
      if (isSessionRedirect(res)) throw new ImportError(importStatusMessage(stage, 401));
      return res;
    };
    setError(null);
    setModelProgress(null);
    setMode(null);
    // Where a failure happened, to pick its message.
    let at: ImportStage = 'fetch';
    try {
      setStage('fetch');
      const fr = await call(
        '/api/import/fetch',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) },
        'fetch',
      );
      if (!fr.ok) throw new ImportError(importStatusMessage('fetch', fr.status));
      const { markdown, image_url } = (await fr.json()) as { markdown: string; image_url?: string | null };

      // Modes are exclusive (Gemini fallback is paused): server → Ollama only, browser → WebLLM only.
      at = 'mode';
      const mr = await call('/api/import/extract', undefined, 'mode');
      if (!mr.ok) throw new ImportError(importStatusMessage('mode', mr.status));
      const { mode: llmMode } = (await mr.json()) as { mode: Mode };
      setMode(llmMode === 'server' ? 'server' : 'browser');
      let recipe: ExtractedRecipe;
      if (llmMode === 'server') {
        at = 'extract';
        setStage('extract');
        const er = await call(
          '/api/import/extract',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markdown }) },
          'extract',
        );
        if (!er.ok) throw new ImportError(importStatusMessage('extract', er.status));
        recipe = await er.json();
      } else {
        if (!(await hasWebGpu())) {
          throw new ImportError(
            'Ta przeglądarka nie obsługuje WebGPU. Import działa tu tylko z serwerem uruchomionym z LLM_MODE=server.',
          );
        }
        at = 'model';
        setStage('model');
        await ensureEngineReady((p) => {
          if (!signal.aborted) setModelProgress({ text: p.text, progress: p.progress });
        });
        at = 'local';
        setStage('extract');
        recipe = await extractWithWebLlm(markdown);
      }
      if (signal.aborted) return;
      setStage('done');
      onExtracted(recipe, url, image_url ?? null);
    } catch (e) {
      if (signal.aborted) return;
      setError(importErrorMessage(e, at));
      setStage('error');
    }
  }

  const running = stage === 'fetch' || stage === 'model' || stage === 'extract';
  const canSubmit = !!url && !running;
  const steps = stepsFor(mode);
  const currentIdx = running ? steps.indexOf(stage) : -1;

  return (
    <Sheet open onClose={onClose} title="Import przepisu z URL">
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void run();
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <label htmlFor="import-url" className="block text-sm font-medium">
            Adres strony z przepisem
          </label>
          <Input
            id="import-url"
            aria-describedby="import-url-hint"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.jadlonomia.com/..."
            type="url"
            inputMode="url"
            autoComplete="off"
            disabled={running}
          />
          <p id="import-url-hint" className="text-sm text-muted">
            Działa z jadlonomia.com i aniagotuje.pl.
          </p>
        </div>

        {running && (
          <div className="space-y-3">
            <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {steps.map((s, i) => (
                <li
                  key={s}
                  aria-current={i === currentIdx ? 'step' : undefined}
                  className={i === currentIdx ? 'font-medium text-ink' : 'text-muted'}
                >
                  {i + 1}. {STEP_LABEL[s]}
                  {i < currentIdx && ' ✓'}
                </li>
              ))}
            </ol>
            <p role="status" className="text-sm text-muted">
              {stage === 'fetch' && 'Pobieram stronę…'}
              {stage === 'model' && 'Ładuję model (pierwszy raz może potrwać kilka minut)…'}
              {stage === 'extract' && 'Wyciągam przepis…'}
            </p>
            {stage === 'model' && modelProgress && (
              <div
                role="progressbar"
                aria-label="Ładowanie modelu"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(modelProgress.progress * 100)}
                className="h-2 w-full overflow-hidden rounded-block bg-hover"
              >
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${Math.round(modelProgress.progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-control border border-brand px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={onClose} className="flex-1">
            Anuluj
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit} className="flex-1">
            {stage === 'error' ? 'Spróbuj ponownie' : 'Importuj'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
