import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/recipes/abc' }));
vi.mock('@/hooks/usePlan', () => ({ usePlan: () => ({ plan: null }) }));

import { AppShell } from '@/components/shell/AppShell';
import { EmptyState } from '@/components/ui';

describe('AppShell', () => {
  it('exposes a labelled navigation with the four areas in order', () => {
    render(<AppShell>content</AppShell>);
    const nav = screen.getByRole('navigation', { name: 'Główna nawigacja' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(labels).toEqual(['Przepisy', 'Plan', 'Zakupy', 'Ustawienia']);
  });

  it('marks only the current area with aria-current', () => {
    render(<AppShell>content</AppShell>);
    const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Przepisy']);
  });
});

describe('EmptyState', () => {
  it('shows the message and its action', () => {
    render(<EmptyState message="Brak przepisów." action={<button>Dodaj</button>} />);
    expect(screen.getByText('Brak przepisów.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dodaj' })).toBeTruthy();
  });
});
