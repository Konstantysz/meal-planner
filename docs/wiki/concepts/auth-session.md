---
title: "Auth Session and Proxy"
summary: "Supabase Auth via @supabase/ssr: the three client factories, the Next 16 proxy that refreshes sessions and redirects, and which paths are public."
tags: [auth, security]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "Proxy entry"
    path: src/proxy.ts
  - title: "Session refresh and redirects"
    path: src/lib/supabase/middleware.ts
  - title: "Server client"
    path: src/lib/supabase/server.ts
  - title: "Browser client"
    path: src/lib/supabase/client.ts
  - title: "Auth form"
    path: src/components/auth/AuthForm.tsx
  - title: "Recovery callback"
    path: src/app/auth/callback/route.ts
  - title: "useAuth hook"
    path: src/hooks/useAuth.ts
  - title: "Next.js 16 proxy guide (bundled)"
    path: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
---

# Auth Session and Proxy

> [!tldr]
> Email and password auth with Supabase through `@supabase/ssr` cookies. `src/proxy.ts`, Next 16's renamed middleware, runs on every non-asset request: it refreshes the session and redirects logged-out users to `/login`. The only public paths are `/login`, `/signup`, `/forgot-password`, `/auth/callback`, `/share/*` and `/manifest.json`.

## Context

Every data access depends on the Supabase client carrying the user's session, because RLS keys off `auth.uid()`. See [[concepts]] and [[rls-authorization]].

## How it works

| Factory | File | Used by |
|---|---|---|
| `createClient()` | `src/lib/supabase/client.ts` (`'use client'`) | `AuthForm`, settings logout, `useAuth` |
| `createServerSupabase()` | `src/lib/supabase/server.ts` | Route handlers and server-component pages. `setAll` swallows errors because Server Components can't set cookies. |
| `updateSession(req)` | `src/lib/supabase/middleware.ts` | `src/proxy.ts` |

The proxy calls `supabase.auth.getUser()`, which also refreshes the session, and then decides:

| Request | Logged in | Logged out |
|---|---|---|
| `/login`, `/signup`, `/forgot-password` | redirect to `/recipes` | pass |
| `/share/*`, `/manifest.json`, `/auth/callback` | pass | pass |
| anything else, **including `/api/*`** | pass | redirect to `/login` |

The matcher excludes `_next/static`, `_next/image`, `favicon.ico` and `icons/`.

- **Login:** `signInWithPassword`, then `router.push('/recipes')` and `router.refresh()`.
- **Signup:** `signUp`, then the `create_household_with_owner` RPC. See [[household-model]].
- **Password reset:** `/forgot-password` calls `resetPasswordForEmail` and shows the same message whether or not the account exists. The email link hits `/auth/callback?code=…`, which runs `exchangeCodeForSession` and redirects to `/reset-password` (fixed target, no `next` param). That page needs the session and calls `updateUser({ password })`. A bad or expired code redirects to `/login?error=link`. `<origin>/auth/callback` must be listed under Supabase → Authentication → URL Configuration → Redirect URLs, or the link falls back to the Site URL.
- **Logout:** in settings: `signOut()`, then a hard navigation to `/login`.

## Invariants and gotchas

- Next 16 renamed Middleware to **Proxy**. The entry file must be `src/proxy.ts` and export `proxy`. The helper file keeps the old name, `middleware.ts`.
- `/api/*` isn't public. A logged-out `fetch` gets the `/login` page with status 200, not a 401 (see [[api-routes]]). This also makes `GET /api/share/[token]` useless to anonymous visitors.
- Adding a new public page means editing `isPublic` in `src/lib/supabase/middleware.ts`. Forget, and anonymous visitors bounce to `/login`.
- `useAuth()` exists but no component imports it.

## Known gaps

- The login page has no link to `/signup`; users have to type the URL.
- No OAuth and no rate limiting beyond Supabase's defaults.

## Examples

```ts
// src/lib/supabase/middleware.ts: the public-path decision
const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup') || path === '/forgot-password';
const isPublic = path.startsWith('/share/') || path === '/manifest.json' || path === '/auth/callback';
```

## Related

- [[concepts]]
- [[household-model]]
- [[rls-authorization]]
- [[api-routes]]

## Sources

- `src/proxy.ts`, `src/lib/supabase/*.ts`, `src/components/auth/AuthForm.tsx`, `src/hooks/useAuth.ts`
- The bundled Next.js 16 proxy guide: "Starting with Next.js 16, Middleware is now called Proxy"

## Changelog

- 2026-10-04: Added the password-reset flow (`/forgot-password`, `/auth/callback`, `/reset-password`).
- 2026-10-04: Removed the email-confirmation gap (the household is created by a trigger since migration 0006). Added the missing signup link.
- 2026-10-04: Created from the protected-routes section of legacy `auth.md`. Added the proxy rename and the `/api` redirect behaviour.
