import type { ButtonHTMLAttributes } from 'react';

export function Chip({
  selected = false,
  className,
  type = 'button',
  ...props
}: { selected?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`min-h-11 rounded-control border px-3 text-sm lg:min-h-8 ${
        selected ? 'border-ink bg-hover text-ink' : 'border-line text-muted hover:bg-hover'
      } ${className ?? ''}`.trim()}
      {...props}
    />
  );
}
