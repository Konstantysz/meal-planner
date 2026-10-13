import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/** Static label with the chip's 6 px radius and hairline. Not interactive: use `Chip` for toggles. */
export function Tag({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-control border border-line px-2 py-0.5 text-xs text-muted',
        className,
      )}
      {...props}
    />
  );
}
