import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Button, ButtonLink, Card, Chip, Input, Sheet } from '@/components/ui';
import { slotClass } from '@/components/plan/slot-colors';

describe('Button', () => {
  it('is a button that does not submit forms by default and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Zapisz</Button>);
    const b = screen.getByRole('button', { name: 'Zapisz' });
    expect(b.getAttribute('type')).toBe('button');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Zapisz
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ButtonLink', () => {
  it('is a link to its target', () => {
    render(<ButtonLink href="/recipes/new">Dodaj</ButtonLink>);
    expect(screen.getByRole('link', { name: 'Dodaj' }).getAttribute('href')).toBe('/recipes/new');
  });
});

describe('Input', () => {
  it('is a labelled textbox that takes input', () => {
    const onChange = vi.fn();
    render(<Input aria-label="Szukaj" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Szukaj' }), { target: { value: 'zupa' } });
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('Chip', () => {
  it('exposes its selected state', () => {
    const { rerender } = render(<Chip selected={false}>Wege</Chip>);
    expect(screen.getByRole('button', { name: 'Wege' }).getAttribute('aria-pressed')).toBe('false');
    rerender(<Chip selected>Wege</Chip>);
    expect(screen.getByRole('button', { name: 'Wege' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>treść</Card>);
    expect(screen.getByText('treść')).toBeTruthy();
  });
});

describe('Sheet', () => {
  beforeAll(() => {
    // jsdom has no <dialog> behaviour; emulate open/close and the close event.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      if (!this.open) return;
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  });

  const sheet = (open: boolean, onClose: () => void) => (
    <Sheet open={open} onClose={onClose} title="Wybierz">
      <button>w środku</button>
    </Sheet>
  );

  it('opens labelled by its title', () => {
    render(sheet(true, () => {}));
    expect(screen.getByRole('dialog', { name: 'Wybierz' })).toBeTruthy();
  });

  it('calls onClose once when the user closes it (Escape closes natively)', () => {
    const onClose = vi.fn();
    render(sheet(true, onClose));
    (screen.getByRole('dialog', { name: 'Wybierz' }) as HTMLDialogElement).close();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when the parent closes it', () => {
    const onClose = vi.fn();
    const { rerender } = render(sheet(true, onClose));
    rerender(sheet(false, onClose));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a backdrop click but not on a click inside the content', () => {
    const onClose = vi.fn();
    render(sheet(true, onClose));
    fireEvent.click(screen.getByRole('button', { name: 'w środku' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog', { name: 'Wybierz' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('slotClass', () => {
  it('gives each filled position 0–4 its own colour', () => {
    const classes = [0, 1, 2, 3, 4].map((p) => slotClass(p, true));
    expect(new Set(classes).size).toBe(5);
    classes.forEach((c, i) => expect(c).toContain(`bg-slot-${i}`));
  });

  it('uses the neutral colour above position 4 and for empty slots', () => {
    expect(slotClass(5, true)).toContain('bg-hover');
    expect(slotClass(0, false)).not.toContain('bg-slot');
  });
});
