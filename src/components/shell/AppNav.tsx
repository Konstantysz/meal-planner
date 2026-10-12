'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui';
import { NAV_ITEMS } from './nav-items';

/** One navigation landmark: bottom tabs below `lg`, sidebar list from `lg` up (CSS only). */
export function AppNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Główna nawigacja"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-side lg:static lg:border-0 lg:bg-transparent"
    >
      <ul className="flex justify-around lg:flex-col lg:gap-1">
        {NAV_ITEMS.map((item) => {
          const current = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1 lg:flex-none">
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs lg:min-h-9 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-control lg:px-3 lg:text-sm ${
                  current ? 'font-semibold text-brand lg:bg-hover' : 'text-muted hover:text-ink lg:hover:bg-hover'
                }`}
              >
                <Icon name={item.icon} className="size-6 lg:size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
