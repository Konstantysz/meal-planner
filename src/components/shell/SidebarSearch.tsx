import { Icon } from '@/components/ui';

/** Plain GET form: the recipe list reads `q`. */
export function SidebarSearch() {
  return (
    <form action="/recipes" role="search" className="relative">
      <label htmlFor="sidebar-q" className="sr-only">
        Szukaj przepisu
      </label>
      <Icon name="search" className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        id="sidebar-q"
        name="q"
        type="search"
        placeholder="Szukaj przepisu"
        className="min-h-9 w-full rounded-control border border-line bg-background pl-8 pr-2 text-sm placeholder:text-faint"
      />
    </form>
  );
}
