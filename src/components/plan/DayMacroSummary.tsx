import type { Macros } from '@/lib/types';
import { MacroSummary } from '@/components/recipes/MacroSummary';

export function DayMacroSummary({ macros }: { macros: Macros | null }) {
  return (
    <div className="text-xs text-muted border-t border-line pt-1 mt-1">
      <MacroSummary macros={macros} />
    </div>
  );
}
