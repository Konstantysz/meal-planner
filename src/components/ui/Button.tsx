import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';

type Variant = 'primary' | 'outline' | 'link';

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-base font-medium lg:min-h-9 lg:text-sm disabled:opacity-50';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:opacity-90',
  outline: 'border border-line text-ink hover:bg-hover',
  link: 'px-1 text-ink underline underline-offset-2 hover:text-brand',
};

function classes(variant: Variant, className?: string) {
  return `${BASE} ${VARIANTS[variant]} ${className ?? ''}`.trim();
}

/** One `primary` button per screen; everything else is `outline` or `link`. */
export function Button({
  variant = 'outline',
  className,
  type = 'button',
  ...props
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = 'outline',
  className,
  ...props
}: { variant?: Variant } & ComponentProps<typeof Link>) {
  return <Link className={classes(variant, className)} {...props} />;
}
