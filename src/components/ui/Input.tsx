import type { InputHTMLAttributes } from 'react';
import { cx } from './cx';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'min-h-11 w-full rounded-control border border-line bg-background px-3 text-base text-ink placeholder:text-faint lg:min-h-9 lg:text-sm',
        className,
      )}
      {...props}
    />
  );
}
