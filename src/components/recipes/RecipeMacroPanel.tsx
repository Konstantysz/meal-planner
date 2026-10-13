import type { LeftOutReason, RecipeMacros } from '@/lib/macros';
import { MacroSummary } from './MacroSummary';

const REASON_LABEL: Record<LeftOutReason, string> = {
  no_macros: 'brak makro składnika',
  unit: 'jednostki nie da się przeliczyć na gramy',
  no_amount: 'brak ilości',
};

/**
 * Per-serving macros of a recipe. When an ingredient was left out the total is labelled as partial and the
 * „makra niepełne" badge lists what is missing and why.
 */
export function RecipeMacroPanel({ macros }: { macros: RecipeMacros }) {
  const partial = macros.perServing !== null && !macros.complete;
  return (
    <div className="space-y-2 rounded-block border border-line p-3">
      <div className="text-xs text-muted">{partial ? 'Makro per porcja (co najmniej):' : 'Makro per porcja:'}</div>
      <MacroSummary macros={macros.perServing} />
      {macros.leftOut.length > 0 && (
        <div>
          <span className="inline-block rounded-control border border-line px-2 py-0.5 text-xs font-semibold text-ink">
            makra niepełne
          </span>
          <p className="mt-1 text-xs text-muted">Nie wliczono:</p>
          <ul className="list-disc pl-5 text-xs text-muted" aria-label="Składniki pominięte w makro">
            {macros.leftOut.map((l, i) => (
              <li key={i}>
                {l.name} ({REASON_LABEL[l.reason]})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
