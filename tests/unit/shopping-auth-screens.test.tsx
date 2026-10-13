import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ShoppingItem } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: {} }) }));

const hook = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('@/hooks/useShoppingList', () => ({ useShoppingList: () => hook.state }));

import { AuthForm } from '@/components/auth/AuthForm';
import { ShoppingList, OFFLINE_NOTICE } from '@/components/shopping/ShoppingList';

const item = (over: Partial<ShoppingItem>): ShoppingItem => ({
  ingredient_id: 'i1',
  ingredient_name: 'Marchew',
  category: 'warzywa',
  unit: 'g',
  total_amount: 300,
  raw_amounts: [],
  have_it: false,
  incomplete: false,
  ...over,
});

describe('auth screens', () => {
  it('login links to signup and to password reset', () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole('link', { name: 'Zarejestruj się' }).getAttribute('href')).toBe('/signup');
    expect(screen.getByRole('link', { name: 'Nie pamiętam hasła' }).getAttribute('href')).toBe('/forgot-password');
  });

  it('signup links back to login', () => {
    render(<AuthForm mode="signup" />);
    expect(screen.getByRole('link', { name: 'Zaloguj się' }).getAttribute('href')).toBe('/login');
  });

  it('labels the fields', () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Hasło')).toBeTruthy();
  });
});

describe('shopping list screen', () => {
  beforeEach(() => {
    hook.state = { items: [], have: {}, loading: false, offline: false, toggleHave: vi.fn() };
  });

  it('offline banner says the cached list is shown and marks stay on the device, with no sync promise', () => {
    hook.state = { ...hook.state, offline: true, items: [item({})] };
    render(<ShoppingList week="2026-10-12" />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toBe(OFFLINE_NOTICE);
    expect(OFFLINE_NOTICE).not.toMatch(/synchroniz/i);
    expect(OFFLINE_NOTICE).toMatch(/na tym urządzeniu/);
  });

  it('shows an empty state with one action when online and empty', () => {
    render(<ShoppingList week="2026-10-12" />);
    expect(screen.getByRole('link', { name: 'Przejdź do planu' }).getAttribute('href')).toBe('/plan');
  });

  it('empty and offline offers no plan link', () => {
    hook.state = { ...hook.state, offline: true };
    render(<ShoppingList week="2026-10-12" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('groups by category, counts have marks and flags incomplete items', () => {
    const toggleHave = vi.fn();
    hook.state = {
      ...hook.state,
      toggleHave,
      have: { 'i1::g': true },
      items: [item({}), item({ ingredient_id: 'i2', ingredient_name: 'Ser', category: 'nabial', incomplete: true })],
    };
    render(<ShoppingList week="2026-10-12" />);
    expect(screen.getByRole('heading', { name: /Warzywa/ }).textContent).toContain('1/1');
    expect(screen.getByRole('heading', { name: /Nabiał/ }).textContent).toContain('0/1');
    expect(screen.getByText('(brak makro)')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ser/ }));
    expect(toggleHave).toHaveBeenCalledTimes(1);
  });
});
