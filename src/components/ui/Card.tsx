import type { HTMLAttributes } from 'react';

/** Flat surface separated by a hairline: no shadow, no nesting of rounded boxes. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-block border border-line bg-background p-4 ${className ?? ''}`.trim()} {...props} />;
}
