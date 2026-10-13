import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/** Flat surface separated by a hairline: no shadow, no nesting of rounded boxes. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-block border border-line bg-background p-4', className)} {...props} />;
}
