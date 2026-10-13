import type { ReactNode } from 'react';

/** Read-only label (diet, allergen, servings, time). The interactive filter chip is `Chip` in `components/ui`. */
export function RecipeTag({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={
        strong
          ? 'inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-base text-ink'
          : 'inline-flex items-center rounded-control border border-line px-2 py-0.5 text-xs text-muted'
      }
    >
      {children}
    </span>
  );
}
