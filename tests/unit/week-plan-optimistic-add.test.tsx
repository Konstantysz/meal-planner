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
    const free = screen.getAllByLabelText(/^Dodaj posiłek/).length;

    fireEvent.click(screen.getAllByLabelText(/^Dodaj posiłek/)[0]);
    const picker = await screen.findByRole('dialog');
    fireEvent.click(within(picker).getByRole('button', { name: 'Pad Thai' }));

    // The slot is on screen once its cell is no longer offered for adding. It has no row yet, so no controls.
    await waitFor(() => expect(screen.queryAllByLabelText(/^Dodaj posiłek/).length).toBeLessThan(free));
    expect(screen.queryAllByLabelText('Przenieś posiłek')).toHaveLength(0);
    expect(screen.queryAllByLabelText('Przeciągnij posiłek')).toHaveLength(0);
  });

  it('takes the recipe off again when the add fails and the plan cannot be reloaded', async () => {
    let loads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return Promise.resolve(new Response('{}', { status: 500 }));
        if (url.startsWith('/api/recipes')) return Promise.resolve(Response.json(recipes));
        return ++loads === 1 ? Promise.resolve(Response.json(plan)) : Promise.reject(new Error('offline'));
      }),
    );
    render(<WeekPlan weekStart="2026-10-12" />);
    await waitFor(() => expect(screen.getAllByLabelText(/^Dodaj posiłek/).length).toBeGreaterThan(0));

    const free = screen.getAllByLabelText(/^Dodaj posiłek/).length;
    fireEvent.click(screen.getAllByLabelText(/^Dodaj posiłek/)[0]);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pad Thai' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Back to the empty cell: nothing planned is left on screen.
    await waitFor(() => expect(screen.queryAllByLabelText(/^Dodaj posiłek/).length).toBe(free));
  });
});
