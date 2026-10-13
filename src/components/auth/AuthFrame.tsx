import type { ReactNode } from 'react';

export const AUTH_TITLE = 'font-display text-3xl font-extrabold tracking-tight';

/** Centred column shared by login, signup, forgot-password and reset-password. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-12">
      <p className="mb-8 font-display text-lg font-extrabold tracking-tight">Planer Posiłków</p>
      {children}
    </div>
  );
}

/** Message under a form: errors and notices share one hairline box, no extra colours. */
export function FormMessage({ tone, children }: { tone: 'error' | 'notice'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-block border p-3 text-sm ${tone === 'error' ? 'border-ink' : 'border-line'}`}
    >
      {children}
    </p>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
