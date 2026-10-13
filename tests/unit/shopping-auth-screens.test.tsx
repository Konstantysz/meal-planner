import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ShoppingItem } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));

const hook = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('@/hooks/useShoppingList', () => ({ useShoppingList: () => hook.state }));

import { AuthForm } from '@/components/auth/AuthForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { authErrorMessage } from '@/components/auth/auth-errors';
import SettingsPage from '@/app/(app)/settings/page';
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

function fill(email: string | null, password: string) {
  if (email) fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: password } });
  fireEvent.submit(screen.getByRole('button', { name: /Zaloguj$|Zarejestruj$|Zapisz hasło/ }).closest('form')!);
}

describe('auth submit paths', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows initialError as an alert (?error=link path)', () => {
    render(<AuthForm mode="login" initialError="Link wygasł lub jest nieprawidłowy. Poproś o nowy." />);
    expect(screen.getByRole('alert').textContent).toMatch(/Link wygasł/);
  });

  it('login failure shows a generic Polish message, not the Supabase text', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials', status: 400 } });
    render(<AuthForm mode="login" />);
    fill('a@b.pl', 'secret1');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Nieprawidłowy e-mail lub hasło.');
  });

  it('signup failure does not reveal that the account exists', async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered', status: 422 } });
    render(<AuthForm mode="signup" />);
    fill('a@b.pl', 'secret1');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/already|registered/i);
    expect(alert.textContent).toMatch(/Nie udało się utworzyć konta/);
  });

  it('signup without a session shows the email-confirmation notice as status', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthForm mode="signup" />);
    fill('a@b.pl', 'secret1');
    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/link potwierdzający/);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('forgot-password shows the same notice on success and a mapped error on failure', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const { unmount } = render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.pl' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Wyślij link' }).closest('form')!);
    expect((await screen.findByRole('status')).textContent).toMatch(/Jeśli konto/);
    unmount();

    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'boom' } });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.pl' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Wyślij link' }).closest('form')!);
    expect((await screen.findByRole('alert')).textContent).not.toMatch(/boom/);
  });

  it('reset-password shows a mapped Polish error', async () => {
    auth.updateUser.mockResolvedValue({ error: { message: 'Auth session missing!' } });
    render(<ResetPasswordForm />);
    fill(null, 'secret1');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/session missing/i);
    expect(alert.textContent).toMatch(/Nie udało się zapisać hasła/);
  });
});

describe('authErrorMessage', () => {
  it('never echoes the raw message and maps rate limits', () => {
    for (const a of ['login', 'signup', 'forgot', 'reset'] as const) {
      expect(authErrorMessage(a, { message: 'User already registered' })).not.toMatch(/registered/);
      expect(authErrorMessage(a, { status: 429 })).toMatch(/Zbyt wiele prób/);
    }
    expect(authErrorMessage('forgot', { message: 'x' })).toMatch(/Coś poszło nie tak/);
  });
});

describe('settings page', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows an alert when the plan request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Wygeneruj link' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Nie udało się wygenerować linku/);
  });

  it('shows an alert when the share request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'p1' }) })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Wygeneruj link' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByLabelText('Link do planu')).toBeNull();
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
