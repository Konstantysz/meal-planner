> [!IMPORTANT]
> **Kostek, read this first.** On 4 October 2026 we audited the production database and shipped three migrations (`0004`–`0006`, PRs #5, #6, #7).
>
> - RLS let any signed-in user add themselves to another household as owner, and anyone with the anon key could list every share link and plan. Both are closed.
> - Share links go through the `get_shared_plan` RPC.
> - A trigger creates the household on signup.
> - Recipes are saved atomically by the `save_recipe` RPC.
>
> Every change was checked with a script on the live database before and after the deploy.
>
> **Important:** merging into `main` deploys new migrations to production right away (Supabase GitHub integration, "Deploy to production").
>
> Where things are:
>
> - [`docs/wiki/references/migration-history.md`](docs/wiki/references/migration-history.md): what changed, why, and how it was verified; open issues (mainly the ingredient catalog). **Start here.**
> - [`docs/wiki/guides/apply-migration.md`](docs/wiki/guides/apply-migration.md): how to add the next migration (baseline, PR, merge, verify).
> - [`docs/wiki/references/database-schema.md`](docs/wiki/references/database-schema.md): current tables, policies and functions.
> - [`docs/wiki/references/known-gaps.md`](docs/wiki/references/known-gaps.md): known bugs.
> - [`docs/wiki/guides/local-dev-setup.md`](docs/wiki/guides/local-dev-setup.md): Node 24 is required; plus `.env.local` and `.mcp.json` (Supabase MCP, read-only).
> - `supabase/checks/` (verification scripts) and `supabase/rollbacks/` (manual rollbacks).

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
