> [!IMPORTANT]
> **Kostek, przeczytaj najpierw.** 4 października 2026 zrobiliśmy audyt bazy danych na produkcji i wdrożyliśmy trzy migracje (`0004`–`0006`, PR #5, #6, #7).
>
> - Polityki RLS pozwalały m.in. dopisać się do cudzego gospodarstwa jako owner, a każdy z kluczem anon mógł wylistować wszystkie linki udostępniania i plany. To jest już zamknięte.
> - Linki udostępniania działają przez RPC `get_shared_plan`.
> - Gospodarstwo tworzy trigger przy rejestracji.
> - Przepis zapisuje się atomowo przez `save_recipe`.
>
> Każdą zmianę sprawdziliśmy skryptem na żywej bazie przed i po deployu.
>
> **Ważne:** merge do `main` od razu wdraża nowe migracje na produkcję (integracja Supabase z GitHubem, „Deploy to production”).
>
> Gdzie co jest:
>
> - [`docs/wiki/references/migration-history.md`](docs/wiki/references/migration-history.md): co, dlaczego i jak zweryfikowane; otwarte problemy (głównie katalog składników). **Zacznij tutaj.**
> - [`docs/wiki/guides/apply-migration.md`](docs/wiki/guides/apply-migration.md): jak dodać kolejną migrację (baseline, PR, merge, weryfikacja).
> - [`docs/wiki/references/database-schema.md`](docs/wiki/references/database-schema.md): aktualne tabele, polityki i funkcje.
> - [`docs/wiki/references/known-gaps.md`](docs/wiki/references/known-gaps.md): lista znanych bugów.
> - [`docs/wiki/guides/local-dev-setup.md`](docs/wiki/guides/local-dev-setup.md): wymagany jest Node 24; do tego `.env.local` i `.mcp.json` (Supabase MCP w trybie read-only).
> - `supabase/checks/` (skrypty weryfikacyjne) i `supabase/rollbacks/` (ręczne rollbacki).

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
