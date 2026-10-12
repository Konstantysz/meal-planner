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
    expect(labels).toEqual(['Plan', 'Przepisy', 'Zakupy', 'Ustawienia']);
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

describe('Sheet', () => {
  it('is labelled and calls onClose once for a user close, not for a parent close', async () => {
    const { Sheet } = await import('@/components/ui');
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet open onClose={onClose} title="Wybierz">
        x
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Wybierz' })).toBeTruthy();
    rerender(
      <Sheet open={false} onClose={onClose} title="Wybierz">
        x
      </Sheet>,
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
