import type { InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-control border border-line bg-background px-3 text-base text-ink placeholder:text-faint lg:min-h-9 lg:text-sm ${className ?? ''}`.trim()}
      {...props}
    />
  );
}
