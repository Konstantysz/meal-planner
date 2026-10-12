import type { ReactNode } from 'react';
import { AppNav } from './AppNav';
import { SidebarSearch } from './SidebarSearch';
import { WeekRecipes } from './WeekRecipes';

/**
 * Sidebar from `lg` up, bottom tabs below it; the switch is CSS only. The nav is one element:
 * fixed to the bottom on small screens, a block inside the sidebar on large ones.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-16 lg:grid lg:grid-cols-[16rem_1fr] lg:pb-0">
      <aside className="contents lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-4 lg:overflow-y-auto lg:border-r lg:border-line lg:bg-side lg:p-4">
        <p className="hidden font-display text-lg font-extrabold tracking-tight lg:block">Planer Posiłków</p>
        <div className="hidden lg:block">
          <SidebarSearch />
        </div>
        <AppNav />
        <div className="hidden lg:block">
          <WeekRecipes />
        </div>
      </aside>
      <main className="min-w-0 lg:col-start-2 lg:row-start-1">{children}</main>
    </div>
  );
}
