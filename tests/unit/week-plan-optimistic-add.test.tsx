import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { WeekPlan } from '@/components/plan/WeekPlan';

const plan = { id: 'p1', household_id: 'h1', week_start_date: '2026-10-12', slots: [] };
const recipes = [{ id: 'r1', name: 'Pad Thai' }];

beforeAll(() => {
  // jsdom has no <dialog> behaviour; emulate open/close.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(() => vi.unstubAllGlobals());

describe('WeekPlan adding a recipe', () => {
  it('shows the recipe before the server has answered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return new Promise(() => {}); // the server never answers
        if (url.startsWith('/api/recipes')) return Promise.resolve(Response.json(recipes));
        return Promise.resolve(Response.json(plan));
      }),
    );
    render(<WeekPlan weekStart="2026-10-12" />);
    await waitFor(() => expect(screen.getAllByLabelText(/^Dodaj posiłek/).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByLabelText(/^Dodaj posiłek/)[0]);
    const picker = await screen.findByRole('dialog');
    fireEvent.click(within(picker).getByRole('button', { name: 'Pad Thai' }));

    // Only a planned slot has a move button (the recipe chip also says Pad Thai).
    expect((await screen.findAllByLabelText('Przenieś posiłek')).length).toBeGreaterThan(0);
  });
});
