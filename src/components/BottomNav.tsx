'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/recipes', label: 'Przepisy', icon: '📖' },
  { href: '/plan', label: 'Plan', icon: '📅' },
  { href: '/shopping', label: 'Zakupy', icon: '🛒' },
  { href: '/settings', label: 'Ustawienia', icon: '⚙️' },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex justify-around py-2 z-50">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href}
          className={`flex flex-col items-center text-xs ${path.startsWith(t.href) ? 'text-green-700' : 'text-gray-500'}`}>
          <span className="text-xl">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
