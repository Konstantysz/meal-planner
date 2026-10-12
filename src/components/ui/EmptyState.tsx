import type { ReactNode } from 'react';

/** Says what to do next, with at most one action. */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <p className="text-muted">{message}</p>
      {action}
    </div>
  );
}
