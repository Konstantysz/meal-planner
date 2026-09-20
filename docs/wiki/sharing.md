# Sharing

Read-only share links: `generateShareToken()` (32-char URL-safe) in `src/lib/share-token.ts`, `createShareToken` (retry-on-collision) in `src/lib/db/households.ts`. `/share/[token]` is a public page (no auth) rendering a plan read-only via `maybeSingle()` + `notFound()`.

Household invites: see [auth.md](auth.md) — email-based invites are not implemented; `inviteMember` requires a resolved user UUID.
