---
title: "0014 Recipe Photos Are Hotlinked"
summary: "A recipe keeps a remote image_url from an allow-listed source host and the app hotlinks it; nothing is copied into Supabase Storage."
tags: [recipes, import, security]
aliases: []
status: review
owner: "@konstantysz"
created: 2026-10-13
updated: 2026-10-13
last_reviewed: null
review_interval_days: 180
confidence: medium
llm_generated: true
llm_model: "claude-sonnet-5-5"
human_reviewed: false
verified_commit: 5e8ed97
sources:
  - title: "Migration 0011"
    path: supabase/migrations/0011_recipe_image_url.sql
  - title: "Allowed image hosts"
    path: src/lib/image-hosts.ts
  - title: "Photo extraction"
    path: src/lib/import/image.ts
  - title: "Photo layer"
    path: src/components/recipes/RecipePhoto.tsx
  - title: "Image config"
    path: next.config.ts
---

# 0014 Recipe Photos Are Hotlinked

> [!tldr]
> `recipes.image_url` holds an https URL on one of a few source-site hosts. The import fills it from the page's JSON-LD `image` or `og:image`, the form can edit it, and `next/image` renders it. No bytes are stored by this app. Revisit Supabase Storage if hotlinks prove unreliable.

## Context

Recipes had no image, and the redesign cover (see [[design-brief]]) takes an optional photo. Issue Konstantysz/meal-planner#43 (part of epic #47) asked to choose between hotlinking and copying into Supabase Storage. The project is on the Free plan. See [[decisions]].

## Decision

**Status:** accepted (migration `0011_recipe_image_url.sql`, issue Konstantysz/meal-planner#43).

- A nullable `recipes.image_url text` with a check that it starts with `http://` or `https://` and has at most 2048 characters. `save_recipe` and `update_recipe` store it (blank or missing = null).
- Only hosts in `IMAGE_HOSTS` (`src/lib/image-hosts.ts`) are accepted: `RecipeInputSchema` rejects any other host, the import drops an `og:image` on another host, and `next.config.ts` builds `images.remotePatterns` from the same list. Adding a source site means adding its image host there.
- The import (`extractImageUrl`) prefers the JSON-LD Recipe `image`, then `og:image`. The user can change or clear the URL in the review form and in the recipe form.
- `RecipePhoto` is the photo layer of a cover. If the URL is missing, not allowed or fails to load, it renders nothing and the colour underneath is the fallback.
- The recipe page credits the photo's own host under it („Zdjęcie: jadlonomia.com").
- `images.maximumRedirects` is 0 in `next.config.ts`: `next/image` does not re-check `remotePatterns` on a redirect, so an open redirect on an allowed host would let anyone point `/_next/image` at any public host. A photo URL that redirects therefore fails and the fallback colour shows.
- `RecipeInputSchema` normalises the URL with `new URL(v).href` (lowercase scheme) so it passes the case-sensitive DB check.

## Alternatives considered

- **Copy into Supabase Storage**: survives the source site changing or removing the image, but needs a bucket, storage RLS policies, size limits and an upload path, and the Free plan has a small storage quota. Not needed until hotlinks break.
- **Accept any https host**: simpler for manual URLs, but `next/image` needs every host in `remotePatterns`, and an arbitrary host lets any signed-in user make the app's image optimizer fetch from anywhere.

## Consequences

- The photo depends on the source site: it can disappear, change or be blocked. The fallback colour covers that.
- A recipe typed in by hand can have a photo only from the supported sites. Photo upload is a later change; the cover layout does not change when it is added.
- Licensing and attribution were not researched with the site owners. The credit line names the host only; whether hotlinking suits each site's terms is unverified.
- `update_recipe` clears the photo when `image_url` is omitted from the payload, so every editing client must send the stored value (the edit form does).
- The two source sites' image hosts were taken from the repo fixtures (`tests/fixtures/*/sample.html`), not from live pages, because the build sandbox could not reach them.

## Related

- [[decisions]]
- [[recipe-management]]
- [[import-pipeline]]
- [[design-brief]]
- [[migration-history]]

## Sources

- `supabase/migrations/0011_recipe_image_url.sql`, `src/lib/image-hosts.ts`, `src/lib/import/image.ts`, `next.config.ts`
- Next.js docs, `next/image` `remotePatterns` (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`)
- Issue Konstantysz/meal-planner#43

## Changelog

- 2026-10-13: Review fixes: redirects disabled, URL normalised, credit uses the photo host.
- 2026-10-13: Created with migration 0011.
