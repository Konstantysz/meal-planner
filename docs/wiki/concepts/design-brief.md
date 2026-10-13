---
title: "Design Brief"
summary: "Visual direction for the app: tone, type scale, light and dark palette, spacing and radius, density, motion, and how a recipe cover takes an optional photo."
tags: [ui]
aliases: []
status: draft
owner: "@konstantysz"
created: 2026-10-13
updated: 2026-10-13
last_reviewed: null
review_interval_days: 30
confidence: medium
llm_generated: true
llm_model: "claude-sonnet-5-5"
human_reviewed: false
verified_commit: e0f0256
sources:
  - title: "Theme tokens today (create-next-app defaults)"
    path: src/app/globals.css
  - title: "Root layout (fonts, lang, metadata)"
    path: src/app/layout.tsx
  - title: "Viewport switch the shell replaces"
    path: src/components/plan/WeekPlan.tsx
  - title: "App name and theme colour"
    path: public/manifest.json
  - title: "Structure prototype, treatment 3 (private claude.ai artifact)"
    url: "https://claude.ai/artifact/4ymb96mmWzYvW5STSTkYtF"
    accessed: 2026-10-13
---

# Design Brief

> [!tldr]
> Warm, homely, airy on mobile and moderately dense on desktop. Bricolage Grotesque for titles and dates, Geist for body. Warm neutrals with a beetroot brand colour (`#A32E55`), five fixed colours for slot positions, hairlines instead of cards and shadows, 4–6 px corners. Light and dark follow the system setting.

## Context

Issue #37 (foundations, epic #47) builds the tokens, primitives and app shell. The per-screen redesigns (#38–#41) build on them. This page is the reference for all of that. Read it, and use the `frontend-design` skill, before building or restyling UI.

Every decision below comes from the style interview of 2026-10-13 (answers cited as "interview"). The structure and colours were settled on the prototype listed in Sources. The `src/app/globals.css` of today still holds the create-next-app defaults (white and near-black, Arial body).

> [!note] Text on slot colours
> Measured when the tokens landed: `ink` on the five slot colours is 10.4–11.8:1 in light and 7.5–9.2:1 in dark. `muted` is 4.0–4.6:1 in light and 3.4–4.2:1 in dark, which fails for small text. Text on a slot colour therefore uses `ink` (token `on-slot`), never `muted`.

## Direction and tone

- **Personality:** warm, cozy, homely (interview). References that fit: Notion for cleanness, Steam library for layout (not its colours), Jadłonomia for blog character, Google Calendar for a readable week grid.
- **Rejected:** Facebook, aniagotuje and anything that reads as generated. A first palette page was rejected because of structure, not colour: rounded cards inside rounded cards, one radius everywhere, pill chips, coloured dots, a monogram tile, a dashed "add" box, and a primary and secondary button pair on everything. Do not bring those back.
- **Structure over decoration:** separation comes from hairlines and alignment. No card shadows, no gradients as decoration, no pills.
- **App name:** „Planer Posiłków" (from `public/manifest.json`).

## Type

| Role | Face | Weight | Size |
|---|---|---|---|
| Page title | Bricolage Grotesque | 800 | 26–38 px, tight tracking |
| Section title, day number | Bricolage Grotesque | 600 | 18–24 px |
| Body | Geist | 400 | 14 px desktop, 16 px mobile |
| Secondary text | Geist | 400–500 | 13 px |
| Minimum | Geist | 400 | 12 px (the prototype's 11 px cover time and tab labels are 12 px in the build) |

- Body is 16 px on mobile so iOS does not zoom into inputs (interview Q4).
- Numbers that align (dates, amounts, macros) use `font-variant-numeric: tabular-nums`.
- Cover titles use `text-wrap: balance` and `hyphens: auto`; Polish words are long.
- Load both faces with `next/font/google`, as `layout.tsx` already does for Geist.

## Colour

Light and dark are both fully designed and follow `prefers-color-scheme` (interview). The brand colour marks today, the one filled button per screen, and the active navigation icon. Focus rings and the "today" day label use it too. Nothing else is brand-coloured.

`faint` is for icons and other non-text marks (3:1 against every surface). Text uses `muted` or `ink`. Measured contrast: `muted` and `ink` pass 4.5:1 on `background`, `side` and `hover` in light, and `muted` passes on them in dark. `faint` passes 3:1 on all three surfaces in both themes.

| Token | Light | Dark |
|---|---|---|
| `background` | `#FCFAF6` | `#1B1715` |
| `side` (sidebar, panels) | `#F4EFE6` | `#231E1B` |
| `ink` | `#2B2420` | `#EDE6DD` |
| `muted` | `#6E6259` | `#A59B91` |
| `faint` | `#8A7E73` | `#8D8379` |
| `line` (hairlines) | `#E8E0D4` | `#332D28` |
| `hover` | `#EDE6DA` | `#2D2723` |
| `brand` | `#A32E55` | `#E88AA8` |
| `on-brand` | `#FFFFFF` | `#3A0E1D` |

### Slot colours

Colour carries a category (interview Q2). For this iteration the category is the slot position, fixed for every household. A recipe cover takes the colour of the position it is most often planned in; on a tie the most recently planned position wins, and a recipe never planned uses `hover`. The count covers the household's plans. Colour by cuisine type is a possible later change and out of scope for #37.

| Position | Name | Light | Dark |
|---|---|---|---|
| 0 śniadanie | butter | `#F4E1A8` | `#54451F` |
| 1 lunch | sky | `#C8DFE4` | `#264349` |
| 2 obiad | sage | `#D3E0BE` | `#384722` |
| 3 przekąska | peach | `#F2CDBE` | `#55332A` |
| 4 kolacja | lilac | `#E3CFE0` | `#46344A` |

Positions above 4 exist on mobile (see [[week-plan]]); they use `hover` until a product decision says otherwise.

Components use tokens only. No hard-coded colours in components.

## Spacing, radius, density

- **Spacing:** 4 px base; steps 4, 8, 12, 16, 24, 32, 48. These are Tailwind's default scale (`1`, `2`, `3`, `4`, `6`, `8`, `12`); there are no custom spacing tokens.
- **Radius:** 4 px for blocks and covers, 6 px for buttons, inputs and chips, 10 px for dialogs and sheets only. A radius is never reused for nesting; a shape inside a shape has a smaller radius or none.
- **Density:** airy on mobile with 44 px touch targets; moderately dense on desktop (interview). Content columns stay under about 70 characters for reading text.

## Layout

| Surface | Desktop | Mobile |
|---|---|---|
| Shell | Sidebar: name, search, navigation, this week's recipes | Bottom tabs: Plan, Przepisy, Zakupy, Ustawienia |
| Plan | Calendar-style grid: small day names, large date numbers, today circled in brand, blocks tinted by slot position | Agenda list, one row per day |
| Recipes | Steam-style shelves of tall covers | Same shelves, horizontal scroll |
| Recipe | Notion-style page: cover band, large title, property list (Porcje, Czas, Na porcję, Źródło), ingredients beside numbered steps | One column |

- The shell switches with CSS (container and media queries), not with the `matchMedia` branch in `WeekPlan.tsx`.
- Icons are SVG, not emoji.
- "Usuń" sits apart from "Edytuj". It turns red only in its confirmation dialog.
- Empty states say what to do next, in Polish, with one action.

## Components

- **Button:** one filled brand button per screen; everything else is outlined or a plain link (interview Q5).
- **Dialog and sheet:** one component; a centred dialog on desktop and a bottom sheet on mobile, both with the 10 px radius (interview Q6).
- **Primitives to build in #37:** button, input, card (flat, hairline, no shadow), chip (6 px radius, not a pill), dialog/sheet, empty state.

## Motion

Subtle, and only in response to an action (interview). Opening a dialog or sheet fades and slides about 120 ms. No entrance animation on load, no hover animation on every card. `prefers-reduced-motion` turns all of it off.

## Recipe cover and photos

A cover is 3:4. Without a photo it is the recipe name set large (Bricolage 800, about 21 px) on its slot colour, with the cooking time at the top. With a photo (interview Q7) the photo fills the cover and the name sits on a bottom gradient for legibility. On the recipe page the photo replaces the colour band. The layout does not change between the two cases, so adding photo upload later changes no layout.

## Examples

```css
/* src/app/globals.css, Tailwind v4 CSS-first */
@theme {
  --color-brand: #a32e55;
  --radius-block: 4px;
  --radius-control: 6px;
  --radius-sheet: 10px;
}
```

## Related

- [[concepts]]: concept index
- [[week-plan]]: the plan views this brief restyles
- [[recipe-management]]: recipe list and detail pages

## Sources

- Style interview of 2026-10-13 (questions Q1–Q7 and the earlier rounds), between the maintainer and the agent.
- The structure prototype (private claude.ai artifact in the frontmatter), which held the values above as CSS variables. Its kept copy in the repo was removed when #37 shipped.
- `src/app/globals.css` and `src/app/layout.tsx` for the current defaults.

## Changelog

- 2026-10-13: Review follow-up: brand focus ring measured (6.8–7.3:1 dark, 6.0–6.5:1 light); spacing steps map to Tailwind's scale.
- 2026-10-13: Tokens, primitives and shell implemented (#37, #49). Contrast on slot colours measured; `on-slot` token added. Prototype copy removed.
- 2026-10-13: Fixed review findings: `faint` and light `muted` darkened for contrast, brand-colour list, tie-break, 12 px minimum note, prototype source lifetime.
- 2026-10-13: Maintainer accepted the brief; implementation tracked in #49. Status stays `draft` until a human review.
- 2026-10-13: Created from the style interview.
