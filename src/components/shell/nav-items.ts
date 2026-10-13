import type { IconName } from '@/components/ui';

export const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; icon: IconName }> = [
  { href: '/recipes', label: 'Przepisy', icon: 'recipes' },
  { href: '/plan', label: 'Plan', icon: 'plan' },
  { href: '/shopping', label: 'Zakupy', icon: 'shopping' },
  { href: '/settings', label: 'Ustawienia', icon: 'settings' },
];
