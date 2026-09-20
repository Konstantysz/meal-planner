Używam skilla **writing-plans** do stworzenia planu implementacji.

Zapiszę plan w `docs/superpowers/plans/2026-09-20-meal-planner-mvp.md`.

---

# Plan implementacji: Aplikacja do planowania posiłków (MVP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować PWA do planowania posiłków z własną bazą przepisów, importem z URL (jadłonomia, aniagotuje), planem tygodnia i listą zakupów.

**Architecture:** Next.js 15 (App Router) + Supabase (Postgres + Auth + RLS). Logika AI (ekstrakcja przepisów) w przeglądarce przez WebLLM z fallbackiem na Gemini Flash API. Offline tylko dla listy zakupów (IndexedDB + sync przy powrocie online).

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`), Vitest, React Testing Library, Zod, cheerio, turndown, `@mlc-ai/web-llm`, `idb`, `date-fns`, `@dnd-kit/core`, `@dnd-kit/sortable`.

**Spec:** Decyzje z sesji grilling (brak formalnego pliku spec — ten plan jest specyfikacją).

## Global Constraints

- Node 20+, pnpm 9+
- Wszystkie współdzielone typy w `src/lib/types.ts`; schematy Zod w `src/lib/schemas.ts`
- Komentarze i nazwy w kodzie: angielski. Teksty UI: polski.
- Zakaz `any` — używaj `unknown` + parsowanie Zod
- Każda funkcja w `src/lib/` ma test jednostkowy w `tests/unit/`
- Commity: Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`)
- Supabase RLS **włączone** na każdej tabeli z danymi użytkownika
- Makro w bazie składników: per 100 g. Makro w przepisie: per porcja.
- Preferowane jednostki: gramy (ciała stałe), mililitry (płyny)
- Budżet: 0 zł — Vercel Hobby + Supabase Free + Gemini Flash free tier
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server), `GEMINI_API_KEY` (server) — wszystkie w env
- Format JSON-LD schema.org/Recipe jako kontrakt ekstrakcji AI

## Review Focus

Poniższe przypadki nie wynikają wprost ze specyfikacji, a mogą zepsuć aplikację. Każdy ma test w zadaniu, które posiada dany kod:

1. **Przepis z zerem porcji lub bez składników** — dzielenie przez zero w makro; oczekiwane: `null` makro, brak crasha. (Task 6)
2. **Ten sam składnik w dwóch różnych jednostkach** (np. `2 łyżki oliwy` + `100 ml oliwy`) — agregacja listy zakupów; oczekiwane: dwie linie, nie błędna suma. (Task 11)
3. **Import strony bez treści przepisu** (404, strona logowania) — LLM zwraca śmieci; oczekiwane: błąd walidacji, brak zapisu. (Task 15)
4. **Slot planu wskazujący na usunięty przepis** — FK `ON DELETE SET NULL` + UI pokazuje „przepis usunięty". (Task 9)
5. **Składnik bez makro w bazie** (null values) — suma dzienna; oczekiwane: pominięcie + oznaczenie „dane niepełne". (Task 6 + Task 11)

---

## File Structure

```
meal-planner/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx, signup/page.tsx, layout.tsx
│   │   ├── (app)/layout.tsx, recipes/, plan/, shopping/, settings/
│   │   ├── api/recipes/, ingredients/, plans/, import/, share/, household/
│   │   ├── share/[token]/page.tsx
│   │   ├── layout.tsx, page.tsx, globals.css
│   ├── components/
│   │   ├── ui/ (button, input, select, checkbox, dialog)
│   │   ├── auth/AuthForm.tsx
│   │   ├── recipes/ (RecipeCard, RecipeForm, RecipeList, RecipeFilters, IngredientPicker, MacroSummary)
│   │   ├── plan/ (WeekPlan, WeekPlanDesktop, WeekPlanMobile, PlanSlot, DayMacroSummary)
│   │   ├── shopping/ (ShoppingList, ShoppingItem, CategoryGroup)
│   │   ├── import/ (ImportDialog, ImportReviewForm)
│   │   └── BottomNav.tsx
│   ├── lib/
│   │   ├── supabase/ (client.ts, server.ts, middleware.ts)
│   │   ├── types.ts, schemas.ts, macros.ts, scaling.ts, shopping-list.ts
│   │   ├── off.ts, share-token.ts, ics.ts
│   │   ├── db/ (recipes.ts, ingredients.ts, plans.ts, pantry.ts, households.ts)
│   │   ├── import/ (fetch.ts, clean.ts, extract.ts, schema.ts, worker.ts, engine.ts)
│   │   └── offline/shopping-store.ts
│   └── hooks/ (useAuth.ts, useRecipes.ts, usePlan.ts, useShoppingList.ts)
├── supabase/migrations/0001_initial.sql, seed.sql
├── tests/
│   ├── setup.ts
│   ├── unit/ (macros, scaling, shopping-list, share-token, import/clean, import/extract)
│   └── fixtures/jadlonomia/, aniagotuje/
├── public/manifest.json, icons/
├── .github/workflows/backup.yml, keepalive.yml
└── package.json, tsconfig.json, next.config.js, tailwind.config.ts, vitest.config.ts
```

---

## Task 1: Scaffold projektu (Next.js + PWA + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `public/manifest.json`, `tests/setup.ts`

**Interfaces:**
- Produces: działający `pnpm dev` na `:3000`, `pnpm test` uruchamia Vitest, `pnpm build` produkuje PWA.

- [ ] **Step 1: Inicjalizacja projektu**

```bash
pnpm dlx create-next-app@latest meal-planner --typescript --tailwind --app --src-dir --import-alias "@/*" --use-pnpm --no-eslint
cd meal-planner
```

- [ ] **Step 2: Dodanie zależności**

```bash
pnpm add @supabase/ssr @supabase/supabase-js zod date-fns cheerio turndown idb @dnd-kit/core @dnd-kit/sortable @mlc-ai/web-llm
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Konfiguracja Vitest**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

`tests/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Skrypty w `package.json`**

Dodaj do `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 5: Manifest PWA**

`public/manifest.json`:
```json
{
  "name": "Planer Posiłków",
  "short_name": "Planer",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#16a34a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Dodaj do `src/app/layout.tsx` w `<head>`:
```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#16a34a" />
```

- [ ] **Step 6: Smoke test**

`tests/unit/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Uruchomienie i commit**

```bash
pnpm test
pnpm typecheck
git add -A
git commit -m "chore: scaffold Next.js + PWA + Vitest"
```

---

## Task 2: Typy i schematy Zod

**Files:**
- Create: `src/lib/types.ts`, `src/lib/schemas.ts`, `tests/unit/schemas.test.ts`

**Interfaces:**
- Produces: typy `Recipe`, `Ingredient`, `Plan`, `PlanSlot`, `ShoppingItem`, `Macros`, `Household`; schematy Zod `RecipeSchema`, `IngredientSchema`, `PlanSlotSchema`, `RecipeJsonLdSchema`.

- [ ] **Step 1: Zdefiniuj typy**

`src/lib/types.ts`:
```typescript
export type Visibility = 'private' | 'household' | 'public_link';
export type DietTag = 'wegetarianska' | 'ketogeniczna' | 'bezglutenowa';
export type Allergen = 'gluten' | 'mieso' | 'nabial' | 'orzechy' | 'ryby';
export type MacroSource = 'off' | 'manual' | 'ai_estimate';
export type IngredientCategory =
  | 'warzywa' | 'owoce' | 'mieso' | 'ryby' | 'nabial' | 'pieczywo'
  | 'makarony' | 'przyprawy' | 'tluszcze' | 'napoje' | 'inne';

export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
  default_unit: string | null;
  source: MacroSource;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  position: number;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  author_id: string;
  name: string;
  servings_base: number;
  prep_time_min: number | null;
  source_url: string | null;
  visibility: Visibility;
  diet_tags: DietTag[];
  allergens: Allergen[];
  created_at: string;
}

export interface Plan {
  id: string;
  household_id: string;
  week_start_date: string;
}

export interface PlanSlot {
  id: string;
  plan_id: string;
  date: string;
  position: number;
  label: string | null;
  recipe_id: string | null;
  servings: number;
}

export interface ShoppingItem {
  ingredient_id: string;
  ingredient_name: string;
  category: IngredientCategory;
  unit: string | null;
  total_amount: number | null;
  raw_amounts: string[];
  have_it: boolean;
  incomplete: boolean;
}
```

- [ ] **Step 2: Napisz failing test dla `RecipeJsonLdSchema`**

`tests/unit/schemas.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { RecipeJsonLdSchema } from '@/lib/schemas';

describe('RecipeJsonLdSchema', () => {
  it('accepts minimal valid recipe', () => {
    const parsed = RecipeJsonLdSchema.parse({
      name: 'Zupa pomidorowa',
      recipeIngredient: ['2 kg pomidorów', '1 cebula'],
      recipeInstructions: ['Ugotuj pomidory', 'Dodaj cebulę'],
      recipeYield: '4 porcje',
    });
    expect(parsed.name).toBe('Zupa pomidorowa');
    expect(parsed.recipeIngredient).toHaveLength(2);
  });

  it('rejects recipe without name', () => {
    expect(() =>
      RecipeJsonLdSchema.parse({
        recipeIngredient: ['x'],
        recipeInstructions: ['y'],
      })
    ).toThrow();
  });

  it('accepts recipeInstructions as string', () => {
    const parsed = RecipeJsonLdSchema.parse({
      name: 'Test',
      recipeIngredient: ['a'],
      recipeInstructions: 'Zrób coś',
    });
    expect(parsed.recipeInstructions).toBe('Zrób coś');
  });
});
```

- [ ] **Step 3: Uruchom — powinno failować**

```bash
pnpm test tests/unit/schemas.test.ts
```
Expected: FAIL — `RecipeJsonLdSchema is not defined`.

- [ ] **Step 4: Implementuj schematy**

`src/lib/schemas.ts`:
```typescript
import { z } from 'zod';

export const RecipeJsonLdSchema = z.object({
  name: z.string().min(1),
  recipeIngredient: z.array(z.string()).default([]),
  recipeInstructions: z.union([
    z.string(),
    z.array(z.string()),
    z.array(z.object({ text: z.string() })),
  ]).default([]),
  recipeYield: z.union([z.string(), z.number()]).optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  totalTime: z.string().optional(),
  image: z.union([z.string(), z.array(z.string())]).optional(),
});

export const IngredientInputSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum([
    'warzywa','owoce','mieso','ryby','nabial','pieczywo',
    'makarony','przyprawy','tluszcze','napoje','inne',
  ]),
  kcal_per_100g: z.number().nonnegative().nullable(),
  protein_per_100g: z.number().nonnegative().nullable(),
  fat_per_100g: z.number().nonnegative().nullable(),
  carbs_per_100g: z.number().nonnegative().nullable(),
  default_unit: z.string().nullable(),
  source: z.enum(['off', 'manual', 'ai_estimate']),
});

export const RecipeIngredientInputSchema = z.object({
  ingredient_id: z.string().uuid(),
  amount: z.number().nonnegative().nullable(),
  unit: z.string().nullable(),
  raw_text: z.string().min(1),
  position: z.number().int().nonnegative(),
});

export const RecipeInputSchema = z.object({
  name: z.string().min(1).max(200),
  servings_base: z.number().int().positive(),
  prep_time_min: z.number().int().nonnegative().nullable(),
  source_url: z.string().url().nullable(),
  visibility: z.enum(['private', 'household', 'public_link']).default('household'),
  diet_tags: z.array(z.enum(['wegetarianska','ketogeniczna','bezglutenowa'])).default([]),
  allergens: z.array(z.enum(['gluten','mieso','nabial','orzechy','ryby'])).default([]),
  ingredients: z.array(RecipeIngredientInputSchema).min(1),
  steps: z.array(z.object({ position: z.number().int(), text: z.string().min(1) })).min(1),
});

export const PlanSlotInputSchema = z.object({
  plan_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  position: z.number().int().nonnegative(),
  label: z.string().max(50).nullable(),
  recipe_id: z.string().uuid().nullable(),
  servings: z.number().positive(),
});

export type RecipeJsonLd = z.infer<typeof RecipeJsonLdSchema>;
export type RecipeInput = z.infer<typeof RecipeInputSchema>;
export type IngredientInput = z.infer<typeof IngredientInputSchema>;
export type PlanSlotInput = z.infer<typeof PlanSlotInputSchema>;
```

- [ ] **Step 5: Uruchom test**

```bash
pnpm test tests/unit/schemas.test.ts
```
Expected: PASS (3 testy).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared types and Zod schemas"
```

---

## Task 3: Supabase — migracje, RLS, seed składników

**Files:**
- Create: `supabase/migrations/0001_initial.sql`, `supabase/seed.sql`

**Interfaces:**
- Produces: tabele `households`, `household_members`, `ingredients`, `recipes`, `recipe_ingredients`, `recipe_steps`, `plans`, `plan_slots`, `pantry_items`, `share_tokens` z włączonym RLS i politykami.

- [ ] **Step 1: Napisz migrację**

`supabase/migrations/0001_initial.sql`:
```sql
create extension if not exists "pgcrypto";

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  primary key (household_id, user_id)
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('warzywa','owoce','mieso','ryby','nabial','pieczywo','makarony','przyprawy','tluszcze','napoje','inne')),
  kcal_per_100g numeric,
  protein_per_100g numeric,
  fat_per_100g numeric,
  carbs_per_100g numeric,
  default_unit text,
  source text not null check (source in ('off','manual','ai_estimate')) default 'manual',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index ingredients_name_lower_idx on ingredients (lower(name));
create index ingredients_category_idx on ingredients (category);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  name text not null,
  servings_base int not null check (servings_base > 0),
  prep_time_min int,
  source_url text,
  visibility text not null check (visibility in ('private','household','public_link')) default 'household',
  diet_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index recipes_household_idx on recipes (household_id);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  amount numeric,
  unit text,
  raw_text text not null,
  position int not null
);
create index recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null,
  text text not null
);
create index recipe_steps_recipe_idx on recipe_steps (recipe_id);

create table plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start_date date not null,
  unique (household_id, week_start_date)
);
create index plans_household_idx on plans (household_id);

create table plan_slots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  date date not null,
  position int not null,
  label text,
  recipe_id uuid references recipes(id) on delete set null,
  servings numeric not null default 1 check (servings > 0),
  unique (plan_id, date, position)
);
create index plan_slots_plan_idx on plan_slots (plan_id);

create table pantry_items (
  household_id uuid not null references households(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  have_it boolean not null default false,
  primary key (household_id, ingredient_id)
);

create table share_tokens (
  token text primary key,
  plan_id uuid not null references plans(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- RLS
alter table households enable row level security;
alter table household_members enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table plans enable row level security;
alter table plan_slots enable row level security;
alter table pantry_items enable row level security;
alter table share_tokens enable row level security;

-- Helper: czy użytkownik należy do gospodarstwa
create or replace function is_member_of(hid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- households
create policy households_select on households for select using (is_member_of(id));
create policy households_insert on households for insert with check (true);
create policy households_update on households for update using (is_member_of(id));

-- household_members
create policy hm_select on household_members for select using (
  user_id = auth.uid() or is_member_of(household_id)
);
create policy hm_insert on household_members for insert with check (
  user_id = auth.uid() or is_member_of(household_id)
);
create policy hm_delete on household_members for delete using (
  user_id = auth.uid() or is_member_of(household_id)
);

-- ingredients: public read, auth write
create policy ing_select on ingredients for select using (true);
create policy ing_insert on ingredients for insert with check (auth.uid() is not null);
create policy ing_update on ingredients for update using (auth.uid() is not null);

-- recipes
create policy rec_select on recipes for select using (
  visibility = 'public_link'
  or author_id = auth.uid()
  or is_member_of(household_id)
);
create policy rec_insert on recipes for insert with check (
  author_id = auth.uid() and is_member_of(household_id)
);
create policy rec_update on recipes for update using (
  author_id = auth.uid() or is_member_of(household_id)
);
create policy rec_delete on recipes for delete using (
  author_id = auth.uid()
);

-- recipe_ingredients / recipe_steps: dziedziczą po recipes
create policy ri_all on recipe_ingredients for all using (
  exists (select 1 from recipes r where r.id = recipe_id and (
    r.author_id = auth.uid() or is_member_of(r.household_id)
  ))
) with check (
  exists (select 1 from recipes r where r.id = recipe_id and (
    r.author_id = auth.uid() or is_member_of(r.household_id)
  ))
);

create policy rs_all on recipe_steps for all using (
  exists (select 1 from recipes r where r.id = recipe_id and (
    r.author_id = auth.uid() or is_member_of(r.household_id)
  ))
) with check (
  exists (select 1 from recipes r where r.id = recipe_id and (
    r.author_id = auth.uid() or is_member_of(r.household_id)
  ))
);

-- plans / plan_slots / pantry_items
create policy plans_all on plans for all using (is_member_of(household_id))
  with check (is_member_of(household_id));

create policy plan_slots_all on plan_slots for all using (
  exists (select 1 from plans p where p.id = plan_id and is_member_of(p.household_id))
) with check (
  exists (select 1 from plans p where p.id = plan_id and is_member_of(p.household_id))
);

create policy pantry_all on pantry_items for all using (is_member_of(household_id))
  with check (is_member_of(household_id));

-- share_tokens: public read (do walidacji), auth write
create policy st_select on share_tokens for select using (true);
create policy st_insert on share_tokens for insert with check (auth.uid() is not null);
create policy st_delete on share_tokens for delete using (created_by = auth.uid());
```

- [ ] **Step 2: Seed składników**

`supabase/seed.sql` — 40 najczęstszych składników (wartości z Open Food Facts, zaokrąglone). Przykład:
```sql
insert into ingredients (name, category, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, default_unit, source) values
('mąka pszenna', 'pieczywo', 364, 10.3, 1.0, 76.3, 'g', 'off'),
('cebula', 'warzywa', 40, 1.1, 0.1, 9.3, 'g', 'off'),
('pomidor', 'warzywa', 18, 0.9, 0.2, 3.9, 'g', 'off'),
('czosnek', 'warzywa', 149, 6.4, 0.5, 33.1, 'g', 'off'),
('marchew', 'warzywa', 41, 0.9, 0.2, 9.6, 'g', 'off'),
('ziemniak', 'warzywa', 77, 2.0, 0.1, 17.0, 'g', 'off'),
('pierś z kurczaka', 'mieso', 165, 31.0, 3.6, 0.0, 'g', 'off'),
('jajko', 'nabial', 143, 12.6, 9.5, 0.7, 'g', 'off'),
('mleko 2%', 'nabial', 50, 3.4, 2.0, 4.8, 'ml', 'off'),
('masło', 'nabial', 717, 0.9, 81.1, 0.1, 'g', 'off'),
('oliwa z oliwek', 'tluszcze', 884, 0.0, 100.0, 0.0, 'ml', 'off'),
('ryż biały', 'makarony', 349, 7.1, 0.7, 77.2, 'g', 'off'),
('makaron pszenny', 'makarony', 371, 13.0, 1.5, 74.7, 'g', 'off'),
('chleb pszenny', 'pieczywo', 265, 9.0, 3.2, 49.0, 'g', 'off'),
('cukier', 'przyprawy', 400, 0.0, 0.0, 100.0, 'g', 'off'),
('sól', 'przyprawy', 0, 0.0, 0.0, 0.0, 'g', 'off'),
('pieprz czarny', 'przyprawy', 251, 10.4, 3.3, 64.0, 'g', 'off'),
('mleko kokosowe', 'napoje', 197, 2.0, 21.0, 3.0, 'ml', 'off'),
('tofu', 'inne', 76, 8.0, 4.8, 1.9, 'g', 'off'),
('ciecierzyca z puszki', 'inne', 119, 7.0, 2.0, 18.0, 'g', 'off')
-- ... 20 kolejnych: fasola, soczewica, kasza, owsianka, banan, jabłko, cytryna, ogórek, papryka, cukinia, bakłażan, brokuł, szpinak, koperek, pietruszka, bazylia, oregano, imbir, miód, śmietana
;
```

- [ ] **Step 3: Push do Supabase**

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <PROJECT_REF>
pnpm dlx supabase db push
pnpm dlx supabase db execute --file supabase/seed.sql
```

- [ ] **Step 4: Zweryfikuj RLS ręcznie**

W Supabase SQL Editor:
```sql
select * from recipes; -- jako anon: 0 wierszy, brak błędu
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat(db): initial schema, RLS policies, ingredient seed"
```

---

## Task 4: Supabase Auth + chronione route'y

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/components/auth/AuthForm.tsx`, `src/hooks/useAuth.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: env vars z Task 1.
- Produces: `createClient()` (browser), `createServerClient()` (server), `useAuth()` hook, działające `/login`, `/signup`, ochrona `(app)/*`.

- [ ] **Step 1: Klient Supabase**

`src/lib/supabase/client.ts`:
```typescript
'use client';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

`src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* w Server Component nie można ustawiać ciasteczek */ }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Middleware**

`src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup');
  const isPublic = path.startsWith('/share/') || path === '/manifest.json';

  if (!user && !isAuthRoute && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/recipes';
    return NextResponse.redirect(url);
  }
  return response;
}
```

`src/middleware.ts`:
```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(req: NextRequest) {
  return updateSession(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
};
```

- [ ] **Step 3: Formularz auth**

`src/components/auth/AuthForm.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const fn = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/recipes');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-sm mx-auto mt-20">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}</h1>
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="email" className="w-full border rounded px-3 py-2"
      />
      <input
        type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="hasło" className="w-full border rounded px-3 py-2"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="w-full bg-green-600 text-white rounded py-2">
        {loading ? '...' : mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Strony**

`src/app/(auth)/login/page.tsx`:
```tsx
import { AuthForm } from '@/components/auth/AuthForm';
export default function LoginPage() { return <AuthForm mode="login" />; }
```

`src/app/(auth)/signup/page.tsx`:
```tsx
import { AuthForm } from '@/components/auth/AuthForm';
export default function SignupPage() { return <AuthForm mode="signup" />; }
```

- [ ] **Step 5: Po zalogowaniu — utwórz gospodarstwo**

`src/hooks/useAuth.ts`:
```typescript
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { userId, loading };
}
```

- [ ] **Step 6: Test manualny**

```bash
pnpm dev
```
Otwórz `http://localhost:3000/recipes` → przekierowanie na `/login`. Zarejestruj się, sprawdź email (Supabase domyślnie wymaga potwierdzenia — możesz wyłączyć w dashboardzie), zaloguj się.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): Supabase auth with protected routes"
```

---

## Task 5: Baza składników — CRUD + OFF lookup

**Files:**
- Create: `src/lib/db/ingredients.ts`, `src/lib/off.ts`, `src/app/api/ingredients/route.ts`, `src/app/api/ingredients/lookup/route.ts`, `tests/unit/off.test.ts`

**Interfaces:**
- Consumes: `Ingredient`, `IngredientInputSchema` z Task 2; Supabase z Task 4.
- Produces: `listIngredients()`, `createIngredient()`, `searchOff(query)`, endpointy `GET/POST /api/ingredients`, `GET /api/ingredients/lookup?q=`.

- [ ] **Step 1: Failing test dla OFF lookup**

`tests/unit/off.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { mapOffProduct } from '@/lib/off';

describe('mapOffProduct', () => {
  it('maps valid OFF product to IngredientInput', () => {
    const result = mapOffProduct({
      product_name: 'Mąka pszenna',
      nutriments: {
        'energy-kcal_100g': 364,
        proteins_100g: 10.3,
        fat_100g: 1.0,
        carbohydrates_100g: 76.3,
      },
    });
    expect(result?.name).toBe('Mąka pszenna');
    expect(result?.kcal_per_100g).toBe(364);
    expect(result?.source).toBe('off');
  });

  it('returns null when product_name missing', () => {
    expect(mapOffProduct({ nutriments: {} })).toBeNull();
  });

  it('returns null when all macros missing', () => {
    expect(mapOffProduct({ product_name: 'X', nutriments: {} })).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom — fail**

```bash
pnpm test tests/unit/off.test.ts
```

- [ ] **Step 3: Implementuj `off.ts`**

`src/lib/off.ts`:
```typescript
import type { IngredientInput } from './schemas';
import type { IngredientCategory } from './types';

export interface OffProduct {
  product_name?: string;
  nutriments?: Record<string, number | undefined>;
  categories_tags?: string[];
}

const OFF_BASE = 'https://world.openfoodfacts.org';

export function mapOffProduct(p: OffProduct): IngredientInput | null {
  if (!p.product_name) return null;
  const n = p.nutriments ?? {};
  const kcal = n['energy-kcal_100g'];
  const protein = n.proteins_100g;
  const fat = n.fat_100g;
  const carbs = n.carbohydrates_100g;
  if (kcal == null && protein == null && fat == null && carbs == null) return null;
  return {
    name: p.product_name.trim(),
    category: guessCategory(p.categories_tags ?? []),
    kcal_per_100g: kcal ?? null,
    protein_per_100g: protein ?? null,
    fat_per_100g: fat ?? null,
    carbs_per_100g: carbs ?? null,
    default_unit: 'g',
    source: 'off',
  };
}

function guessCategory(tags: string[]): IngredientCategory {
  const t = tags.join(' ').toLowerCase();
  if (t.includes('vegetable')) return 'warzywa';
  if (t.includes('fruit')) return 'owoce';
  if (t.includes('meat')) return 'mieso';
  if (t.includes('fish') || t.includes('seafood')) return 'ryby';
  if (t.includes('dairy') || t.includes('milk')) return 'nabial';
  if (t.includes('bread')) return 'pieczywo';
  if (t.includes('pasta')) return 'makarony';
  if (t.includes('spice') || t.includes('condiment')) return 'przyprawy';
  if (t.includes('oil') || t.includes('fat')) return 'tluszcze';
  if (t.includes('beverage') || t.includes('drink')) return 'napoje';
  return 'inne';
}

export async function searchOff(query: string): Promise<IngredientInput[]> {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,nutriments,categories_tags`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MealPlanner/1.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  const products: OffProduct[] = data.products ?? [];
  return products.map(mapOffProduct).filter((x): x is IngredientInput => x !== null);
}
```

- [ ] **Step 4: Testy PASS**

```bash
pnpm test tests/unit/off.test.ts
```

- [ ] **Step 5: DB helpers + API**

`src/lib/db/ingredients.ts`:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ingredient } from '@/lib/types';
import { IngredientInputSchema, type IngredientInput } from '@/lib/schemas';

export async function listIngredients(supabase: SupabaseClient): Promise<Ingredient[]> {
  const { data, error } = await supabase.from('ingredients').select('*').order('name');
  if (error) throw error;
  return data as Ingredient[];
}

export async function createIngredient(supabase: SupabaseClient, input: unknown): Promise<Ingredient> {
  const parsed = IngredientInputSchema.parse(input);
  const { data, error } = await supabase.from('ingredients').insert(parsed).select().single();
  if (error) throw error;
  return data as Ingredient;
}
```

`src/app/api/ingredients/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { listIngredients, createIngredient } from '@/lib/db/ingredients';

export async function GET() {
  const supabase = await createServerSupabase();
  try { return NextResponse.json(await listIngredients(supabase)); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    return NextResponse.json(await createIngredient(supabase, body), { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
```

`src/app/api/ingredients/lookup/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { searchOff } from '@/lib/off';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });
  return NextResponse.json(await searchOff(q));
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ingredients): CRUD, OFF lookup, API routes"
```

---

## Task 6: Makro i skalowanie (czyste funkcje)

**Files:**
- Create: `src/lib/macros.ts`, `src/lib/scaling.ts`, `tests/unit/macros.test.ts`, `tests/unit/scaling.test.ts`

**Interfaces:**
- Consumes: `Macros` z Task 2.
- Produces: `calculateIngredientMacros(ingredient, grams)`, `sumMacros(list)`, `perServing(total, servings)`, `scaleAmount(item, factor)`, `formatAmount(amount, unit)`.

- [ ] **Step 1: Failing test — makro z zerem porcji**

`tests/unit/macros.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateIngredientMacros, sumMacros, perServing } from '@/lib/macros';

describe('calculateIngredientMacros', () => {
  it('computes macros for grams', () => {
    const r = calculateIngredientMacros(
      { kcal_per_100g: 364, protein_per_100g: 10.3, fat_per_100g: 1, carbs_per_100g: 76.3 },
      200
    );
    expect(r?.kcal).toBe(728);
    expect(r?.protein).toBeCloseTo(20.6);
  });

  it('returns null when ingredient has no macro data', () => {
    const r = calculateIngredientMacros(
      { kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null },
      100
    );
    expect(r).toBeNull();
  });

  it('treats missing fields as zero', () => {
    const r = calculateIngredientMacros(
      { kcal_per_100g: 100, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null },
      100
    );
    expect(r?.kcal).toBe(100);
    expect(r?.protein).toBe(0);
  });
});

describe('sumMacros', () => {
  it('skips nulls', () => {
    const s = sumMacros([
      { kcal: 100, protein: 1, fat: 2, carbs: 3 },
      null,
      { kcal: 50, protein: 1, fat: 1, carbs: 1 },
    ]);
    expect(s.kcal).toBe(150);
  });
});

describe('perServing', () => {
  it('divides by servings', () => {
    const p = perServing({ kcal: 1000, protein: 40, fat: 30, carbs: 100 }, 4);
    expect(p?.kcal).toBe(250);
  });

  it('returns null for zero servings', () => {
    expect(perServing({ kcal: 1000, protein: 0, fat: 0, carbs: 0 }, 0)).toBeNull();
  });

  it('returns null for negative servings', () => {
    expect(perServing({ kcal: 1000, protein: 0, fat: 0, carbs: 0 }, -1)).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom — fail**

```bash
pnpm test tests/unit/macros.test.ts
```

- [ ] **Step 3: Implementuj `macros.ts`**

`src/lib/macros.ts`:
```typescript
import type { Macros } from './types';

export interface IngredientMacroInput {
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
}

export function calculateIngredientMacros(
  ingredient: IngredientMacroInput,
  grams: number
): Macros | null {
  const { kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g } = ingredient;
  if (kcal_per_100g === null && protein_per_100g === null && fat_per_100g === null && carbs_per_100g === null) {
    return null;
  }
  const f = grams / 100;
  return {
    kcal: (kcal_per_100g ?? 0) * f,
    protein: (protein_per_100g ?? 0) * f,
    fat: (fat_per_100g ?? 0) * f,
    carbs: (carbs_per_100g ?? 0) * f,
  };
}

export function sumMacros(list: (Macros | null)[]): Macros {
  return list.reduce<Macros>(
    (acc, m) => m === null ? acc : {
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      fat: acc.fat + m.fat,
      carbs: acc.carbs + m.carbs,
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

export function perServing(total: Macros, servings: number): Macros | null {
  if (servings <= 0) return null;
  return {
    kcal: total.kcal / servings,
    protein: total.protein / servings,
    fat: total.fat / servings,
    carbs: total.carbs / servings,
  };
}
```

- [ ] **Step 4: Testy makro PASS**

```bash
pnpm test tests/unit/macros.test.ts
```

- [ ] **Step 5: Failing test — skalowanie**

`tests/unit/scaling.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { scaleAmount, formatAmount, roundForUnit } from '@/lib/scaling';

describe('scaleAmount', () => {
  it('multiplies structured amount', () => {
    const r = scaleAmount({ amount: 2, unit: 'g', raw_text: '2 g' }, 1.5);
    expect(r.amount).toBe(3);
    expect(r.raw_text).toBe('3 g');
  });

  it('preserves raw_text when amount is null', () => {
    const r = scaleAmount({ amount: null, unit: null, raw_text: 'do smaku' }, 3);
    expect(r.raw_text).toBe('do smaku');
    expect(r.amount).toBeNull();
  });
});

describe('formatAmount', () => {
  it('rounds grams to integer', () => {
    expect(formatAmount(133.7, 'g')).toBe('134 g');
  });
  it('keeps 2 decimals for kg', () => {
    expect(formatAmount(1.237, 'kg')).toBe('1.24 kg');
  });
  it('handles no unit', () => {
    expect(formatAmount(2.5, null)).toBe('2.5');
  });
});

describe('roundForUnit', () => {
  it('integers for g/ml', () => {
    expect(roundForUnit(133.7, 'g')).toBe(134);
    expect(roundForUnit(50.4, 'ml')).toBe(50);
  });
});
```

- [ ] **Step 6: Uruchom — fail**

```bash
pnpm test tests/unit/scaling.test.ts
```

- [ ] **Step 7: Implementuj `scaling.ts`**

`src/lib/scaling.ts`:
```typescript
export interface StructuredAmount {
  amount: number | null;
  unit: string | null;
  raw_text: string;
}

export function roundForUnit(amount: number, unit: string | null): number {
  const u = unit?.toLowerCase() ?? '';
  if (u === 'g' || u === 'ml') return Math.round(amount);
  if (u === 'kg' || u === 'l') return Math.round(amount * 100) / 100;
  return Math.round(amount * 100) / 100;
}

export function formatAmount(amount: number, unit: string | null): string {
  const r = roundForUnit(amount, unit);
  return unit ? `${r} ${unit}` : `${r}`;
}

export function scaleAmount(item: StructuredAmount, factor: number): StructuredAmount {
  if (item.amount === null) return { ...item };
  const scaled = item.amount * factor;
  return {
    amount: scaled,
    unit: item.unit,
    raw_text: formatAmount(scaled, item.unit),
  };
}
```

- [ ] **Step 8: Testy PASS + commit**

```bash
pnpm test tests/unit/scaling.test.ts
git add -A
git commit -m "feat: macro calculation and portion scaling (pure)"
```

---

## Task 7: Przepisy — CRUD (API + formularz)

**Files:**
- Create: `src/lib/db/recipes.ts`, `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`, `src/components/recipes/RecipeForm.tsx`, `src/components/recipes/IngredientPicker.tsx`, `src/app/(app)/recipes/new/page.tsx`, `src/app/(app)/recipes/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `RecipeInputSchema` (Task 2), `createServerSupabase` (Task 4), `listIngredients` (Task 5), `calculateIngredientMacros` (Task 6).
- Produces: `createRecipe(supabase, input, authorId)`, `getRecipe(supabase, id)`, `listRecipes(supabase, filters)`, endpointy `/api/recipes`, `/api/recipes/[id]`, komponent `RecipeForm`.

- [ ] **Step 1: DB helpers**

`src/lib/db/recipes.ts`:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { RecipeInputSchema, type RecipeInput } from '@/lib/schemas';
import type { Recipe } from '@/lib/types';

export interface RecipeWithDetails extends Recipe {
  ingredients: Array<{
    id: string; ingredient_id: string; amount: number | null; unit: string | null;
    raw_text: string; position: number;
    ingredients: { id: string; name: string; category: string;
      kcal_per_100g: number | null; protein_per_100g: number | null;
      fat_per_100g: number | null; carbs_per_100g: number | null } | null;
  }>;
  steps: Array<{ id: string; position: number; text: string }>;
}

export async function listRecipes(
  supabase: SupabaseClient,
  filters: { diet?: string[]; exclude?: string[] } = {}
): Promise<Recipe[]> {
  let q = supabase.from('recipes').select('*').order('created_at', { ascending: false });
  if (filters.diet?.length) q = q.contains('diet_tags', filters.diet);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data as Recipe[];
  if (filters.exclude?.length) {
    rows = rows.filter((r) => !r.allergens.some((a) => filters.exclude!.includes(a)));
  }
  return rows;
}

export async function getRecipe(supabase: SupabaseClient, id: string): Promise<RecipeWithDetails> {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      ingredients:recipe_ingredients(*, ingredients(id, name, category, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g)),
      steps:recipe_steps(id, position, text)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as RecipeWithDetails;
}

export async function createRecipe(
  supabase: SupabaseClient,
  input: unknown,
  authorId: string,
  householdId: string
): Promise<Recipe> {
  const parsed = RecipeInputSchema.parse(input);
  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      author_id: authorId,
      name: parsed.name,
      servings_base: parsed.servings_base,
      prep_time_min: parsed.prep_time_min,
      source_url: parsed.source_url,
      visibility: parsed.visibility,
      diet_tags: parsed.diet_tags,
      allergens: parsed.allergens,
    })
    .select()
    .single();
  if (error) throw error;

  const recipeId = (recipe as Recipe).id;
  const { error: ingErr } = await supabase.from('recipe_ingredients').insert(
    parsed.ingredients.map((i) => ({ ...i, recipe_id: recipeId }))
  );
  if (ingErr) throw ingErr;
  const { error: stepErr } = await supabase.from('recipe_steps').insert(
    parsed.steps.map((s) => ({ ...s, recipe_id: recipeId }))
  );
  if (stepErr) throw stepErr;
  return recipe as Recipe;
}
```

- [ ] **Step 2: API routes**

`src/app/api/recipes/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { listRecipes, createRecipe } from '@/lib/db/recipes';

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const url = new URL(req.url);
  const diet = url.searchParams.getAll('diet');
  const exclude = url.searchParams.getAll('exclude');
  try {
    return NextResponse.json(await listRecipes(supabase, { diet, exclude }));
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { data: household } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  if (!household) return NextResponse.json({ error: 'no household' }, { status: 400 });
  try {
    const body = await req.json();
    const recipe = await createRecipe(supabase, body, user.id, household.household_id);
    return NextResponse.json(recipe, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
```

`src/app/api/recipes/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  try { return NextResponse.json(await getRecipe(supabase, id)); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 404 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: String(error) }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: `IngredientPicker`**

`src/components/recipes/IngredientPicker.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import type { Ingredient } from '@/lib/types';

export interface PickedIngredient {
  ingredient_id: string;
  ingredient_name: string;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  position: number;
}

export function IngredientPicker({
  value, onChange,
}: { value: PickedIngredient[]; onChange: (v: PickedIngredient[]) => void }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/ingredients').then((r) => r.json()).then(setIngredients).catch(() => {});
  }, []);

  const filtered = query.length >= 2
    ? ingredients.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  function add(ing: Ingredient) {
    const raw = `${ing.name}`;
    onChange([...value, {
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      amount: null,
      unit: ing.default_unit,
      raw_text: raw,
      position: value.length,
    }]);
    setQuery('');
  }

  return (
    <div className="space-y-2">
      <input
        placeholder="Szukaj składnika…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      {filtered.length > 0 && (
        <ul className="border rounded divide-y">
          {filtered.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => add(i)} className="w-full text-left px-3 py-2 hover:bg-gray-100">
                {i.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-1">
        {value.map((v, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <input
              value={v.raw_text}
              onChange={(e) => {
                const next = [...value]; next[idx] = { ...v, raw_text: e.target.value }; onChange(next);
              }}
              className="flex-1 border rounded px-2 py-1"
            />
            <input
              type="number"
              value={v.amount ?? ''}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...v, amount: e.target.value === '' ? null : Number(e.target.value) };
                onChange(next);
              }}
              className="w-20 border rounded px-2 py-1"
            />
            <input
              value={v.unit ?? ''}
              onChange={(e) => {
                const next = [...value]; next[idx] = { ...v, unit: e.target.value || null }; onChange(next);
              }}
              className="w-16 border rounded px-2 py-1"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              className="text-red-600 px-2"
            >×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: `RecipeForm`**

`src/components/recipes/RecipeForm.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IngredientPicker, type PickedIngredient } from './IngredientPicker';

const DIETS = ['wegetarianska', 'ketogeniczna', 'bezglutenowa'] as const;
const ALLERGENS = ['gluten', 'mieso', 'nabial', 'orzechy', 'ryby'] as const;

export function RecipeForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [servings, setServings] = useState(4);
  const [prepTime, setPrepTime] = useState<number | null>(null);
  const [dietTags, setDietTags] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<PickedIngredient[]>([]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        servings_base: servings,
        prep_time_min: prepTime,
        source_url: null,
        visibility: 'household',
        diet_tags: dietTags,
        allergens,
        ingredients: ingredients.map((i) => ({
          ingredient_id: i.ingredient_id,
          amount: i.amount,
          unit: i.unit,
          raw_text: i.raw_text,
          position: i.position,
        })),
        steps: steps.filter((s) => s.trim()).map((text, i) => ({ position: i, text })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Błąd zapisu');
      return;
    }
    const recipe = await res.json();
    router.push(`/recipes/${recipe.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl mx-auto p-4">
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa przepisu" className="w-full border rounded px-3 py-2" />
      <div className="flex gap-2">
        <input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} className="w-24 border rounded px-2 py-1" />
        <span className="self-center">porcji, czas (min):</span>
        <input type="number" min={0} value={prepTime ?? ''} onChange={(e) => setPrepTime(e.target.value === '' ? null : Number(e.target.value))} className="w-24 border rounded px-2 py-1" />
      </div>
      <fieldset>
        <legend className="font-semibold">Diety</legend>
        {DIETS.map((d) => (
          <label key={d} className="mr-4">
            <input type="checkbox" checked={dietTags.includes(d)}
              onChange={(e) => setDietTags(e.target.checked ? [...dietTags, d] : dietTags.filter((x) => x !== d))} /> {d}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="font-semibold">Alergeny</legend>
        {ALLERGENS.map((a) => (
          <label key={a} className="mr-4">
            <input type="checkbox" checked={allergens.includes(a)}
              onChange={(e) => setAllergens(e.target.checked ? [...allergens, a] : allergens.filter((x) => x !== a))} /> {a}
          </label>
        ))}
      </fieldset>
      <div>
        <h3 className="font-semibold">Składniki</h3>
        <IngredientPicker value={ingredients} onChange={setIngredients} />
      </div>
      <div>
        <h3 className="font-semibold">Kroki</h3>
        {steps.map((s, i) => (
          <div key={i} className="flex gap-2 my-1">
            <textarea value={s} onChange={(e) => {
              const n = [...steps]; n[i] = e.target.value; setSteps(n);
            }} className="flex-1 border rounded px-2 py-1" />
            <button type="button" onClick={() => setSteps(steps.filter((_, x) => x !== i))} className="text-red-600">×</button>
          </div>
        ))}
        <button type="button" onClick={() => setSteps([...steps, ''])} className="text-green-700">+ krok</button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="bg-green-600 text-white rounded px-4 py-2">
        {saving ? 'Zapisuję…' : 'Zapisz przepis'}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Strona `new`**

`src/app/(app)/recipes/new/page.tsx`:
```tsx
import { RecipeForm } from '@/components/recipes/RecipeForm';
export default function NewRecipePage() {
  return <div className="p-4"><h1 className="text-2xl font-bold mb-4">Nowy przepis</h1><RecipeForm /></div>;
}
```

- [ ] **Step 6: Test manualny + commit**

```bash
pnpm dev
# Otwórz /recipes/new, dodaj przepis, sprawdź w Supabase że rekordy są.
git add -A
git commit -m "feat(recipes): create form + API"
```

---

## Task 8: Przepisy — lista, filtry, widok szczegółów

**Files:**
- Create: `src/components/recipes/RecipeCard.tsx`, `RecipeList.tsx`, `RecipeFilters.tsx`, `MacroSummary.tsx`, `src/app/(app)/recipes/page.tsx`, `src/app/(app)/recipes/[id]/page.tsx`, `src/app/(app)/layout.tsx`, `src/components/BottomNav.tsx`

**Interfaces:**
- Consumes: `listRecipes`, `getRecipe` (Task 7), `calculateIngredientMacros`, `sumMacros`, `perServing` (Task 6).
- Produces: strona `/recipes` z listą i filtrami, strona `/recipes/[id]` ze szczegółami + makro per porcja, `BottomNav` z 4 tabami.

- [ ] **Step 1: Layout `(app)` z BottomNav**

`src/components/BottomNav.tsx`:
```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/recipes', label: 'Przepisy', icon: '📖' },
  { href: '/plan', label: 'Plan', icon: '📅' },
  { href: '/shopping', label: 'Zakupy', icon: '🛒' },
  { href: '/settings', label: 'Ustawienia', icon: '⚙️' },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex justify-around py-2 z-50">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href}
          className={`flex flex-col items-center text-xs ${path.startsWith(t.href) ? 'text-green-700' : 'text-gray-500'}`}>
          <span className="text-xl">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
```

`src/app/(app)/layout.tsx`:
```tsx
import { BottomNav } from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16">
      <main className="max-w-4xl mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: `RecipeCard` i `MacroSummary`**

`src/components/recipes/MacroSummary.tsx`:
```tsx
import type { Macros } from '@/lib/types';

export function MacroSummary({ macros }: { macros: Macros | null }) {
  if (!macros) return <span className="text-gray-400 text-sm">brak danych makro</span>;
  return (
    <span className="text-sm text-gray-700">
      {Math.round(macros.kcal)} kcal · B {macros.protein.toFixed(1)} · T {macros.fat.toFixed(1)} · W {macros.carbs.toFixed(1)}
    </span>
  );
}
```

`src/components/recipes/RecipeCard.tsx`:
```tsx
import Link from 'next/link';
import type { Recipe } from '@/lib/types';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link href={`/recipes/${recipe.id}`}
      className="block border rounded-lg p-4 hover:bg-gray-50">
      <h3 className="font-semibold">{recipe.name}</h3>
      <p className="text-xs text-gray-500 mt-1">
        {recipe.servings_base} porcji
        {recipe.prep_time_min != null && ` · ${recipe.prep_time_min} min`}
      </p>
      {recipe.diet_tags.length > 0 && (
        <div className="mt-2 flex gap-1 flex-wrap">
          {recipe.diet_tags.map((t) => (
            <span key={t} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: `RecipeFilters` i `RecipeList`**

`src/components/recipes/RecipeFilters.tsx`:
```tsx
'use client';

const DIETS = ['wegetarianska', 'ketogeniczna', 'bezglutenowa'];
const ALLERGENS = ['gluten', 'mieso', 'nabial', 'orzechy', 'ryby'];

export function RecipeFilters({
  diet, exclude, onDiet, onExclude,
}: {
  diet: string[]; exclude: string[];
  onDiet: (v: string[]) => void; onExclude: (v: string[]) => void;
}) {
  function toggle(list: string[], v: string, setter: (x: string[]) => void) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }
  return (
    <div className="space-y-2 p-4 border-b">
      <div>
        <span className="text-sm font-semibold mr-2">Diety:</span>
        {DIETS.map((d) => (
          <label key={d} className="mr-3 text-sm">
            <input type="checkbox" checked={diet.includes(d)} onChange={() => toggle(diet, d, onDiet)} /> {d}
          </label>
        ))}
      </div>
      <div>
        <span className="text-sm font-semibold mr-2">Wyklucz:</span>
        {ALLERGENS.map((a) => (
          <label key={a} className="mr-3 text-sm">
            <input type="checkbox" checked={exclude.includes(a)} onChange={() => toggle(exclude, a, onExclude)} /> {a}
          </label>
        ))}
      </div>
    </div>
  );
}
```

`src/components/recipes/RecipeList.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Recipe } from '@/lib/types';
import { RecipeCard } from './RecipeCard';
import { RecipeFilters } from './RecipeFilters';

export function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [diet, setDiet] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    diet.forEach((d) => params.append('diet', d));
    exclude.forEach((e) => params.append('exclude', e));
    setLoading(true);
    fetch(`/api/recipes?${params}`)
      .then((r) => r.json())
      .then(setRecipes)
      .finally(() => setLoading(false));
  }, [diet, exclude]);

  return (
    <div>
      <RecipeFilters diet={diet} exclude={exclude} onDiet={setDiet} onExclude={setExclude} />
      <div className="p-4 space-y-2">
        {loading && <p className="text-gray-500">Ładuję…</p>}
        {!loading && recipes.length === 0 && <p className="text-gray-500">Brak przepisów. Dodaj pierwszy.</p>}
        {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
      </div>
      <Link href="/recipes/new"
        className="fixed bottom-20 right-4 bg-green-600 text-white rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg">
        +
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Strona listy i szczegółów**

`src/app/(app)/recipes/page.tsx`:
```tsx
import { RecipeList } from '@/components/recipes/RecipeList';
export default function RecipesPage() {
  return <div><h1 className="text-2xl font-bold p-4">Przepisy</h1><RecipeList /></div>;
}
```

`src/app/(app)/recipes/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/db/recipes';
import { calculateIngredientMacros, sumMacros, perServing } from '@/lib/macros';
import { MacroSummary } from '@/components/recipes/MacroSummary';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  let recipe;
  try { recipe = await getRecipe(supabase, id); }
  catch { notFound(); }

  const total = sumMacros(recipe.ingredients.map((ri) => {
    if (!ri.ingredients) return null;
    const grams = ri.unit === 'g' || ri.unit === 'ml' ? (ri.amount ?? 0) : 0;
    return calculateIngredientMacros(ri.ingredients, grams);
  }));
  const per = perServing(total, recipe.servings_base);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">{recipe.name}</h1>
      <p className="text-sm text-gray-600">
        {recipe.servings_base} porcji
        {recipe.prep_time_min != null && ` · ${recipe.prep_time_min} min`}
      </p>
      <div className="bg-green-50 rounded p-3">
        <div className="text-xs text-gray-600 mb-1">Makro per porcja:</div>
        <MacroSummary macros={per} />
      </div>
      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">
          Źródło
        </a>
      )}
      <section>
        <h2 className="font-semibold text-lg">Składniki</h2>
        <ul className="list-disc pl-6">
          {recipe.ingredients
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((ri) => <li key={ri.id}>{ri.raw_text}</li>)}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-lg">Kroki</h2>
        <ol className="list-decimal pl-6 space-y-1">
          {recipe.steps
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((s) => <li key={s.id}>{s.text}</li>)}
        </ol>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Test manualny + commit**

```bash
pnpm dev
# Otwórz /recipes, dodaj 2 przepisy, przefiltruj, wejdź w szczegóły
git add -A
git commit -m "feat(recipes): list, filters, detail view with macros"
```

---

## Task 9: Plan tygodnia — typy + API

**Files:**
- Create: `src/lib/db/plans.ts`, `src/app/api/plans/route.ts`, `src/app/api/plans/[id]/slots/route.ts`, `src/app/api/plans/[id]/slots/[slotId]/route.ts`

**Interfaces:**
- Consumes: `PlanSlotInputSchema` (Task 2), Supabase (Task 4).
- Produces: `getOrCreatePlan(supabase, householdId, weekStart)`, `upsertSlot`, `deleteSlot`, `getWeekPlan(supabase, planId)`.

- [ ] **Step 1: DB helpers**

`src/lib/db/plans.ts`:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanSlotInputSchema } from '@/lib/schemas';
import type { Plan, PlanSlot } from '@/lib/types';

export interface PlanWithSlots extends Plan {
  slots: Array<PlanSlot & {
    recipe: { id: string; name: string; servings_base: number } | null;
  }>;
}

export async function getOrCreatePlan(
  supabase: SupabaseClient, householdId: string, weekStart: string
): Promise<Plan> {
  const { data: existing } = await supabase
    .from('plans').select('*')
    .eq('household_id', householdId).eq('week_start_date', weekStart).maybeSingle();
  if (existing) return existing as Plan;
  const { data, error } = await supabase
    .from('plans').insert({ household_id: householdId, week_start_date: weekStart })
    .select().single();
  if (error) throw error;
  return data as Plan;
}

export async function getWeekPlan(supabase: SupabaseClient, planId: string): Promise<PlanWithSlots> {
  const { data, error } = await supabase
    .from('plans')
    .select('*, slots:plan_slots(*, recipe:recipes(id, name, servings_base))')
    .eq('id', planId).single();
  if (error) throw error;
  return data as unknown as PlanWithSlots;
}

export async function upsertSlot(supabase: SupabaseClient, input: unknown): Promise<PlanSlot> {
  const parsed = PlanSlotInputSchema.parse(input);
  const { data, error } = await supabase
    .from('plan_slots')
    .upsert(parsed, { onConflict: 'plan_id,date,position' })
    .select().single();
  if (error) throw error;
  return data as PlanSlot;
}

export async function deleteSlot(supabase: SupabaseClient, slotId: string): Promise<void> {
  const { error } = await supabase.from('plan_slots').delete().eq('id', slotId);
  if (error) throw error;
}
```

- [ ] **Step 2: API routes**

`src/app/api/plans/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getOrCreatePlan, getWeekPlan } from '@/lib/db/plans';

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const weekStart = new URL(req.url).searchParams.get('week');
  if (!weekStart) return NextResponse.json({ error: 'week required' }, { status: 400 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { data: hh } = await supabase.from('household_members')
    .select('household_id').eq('user_id', user.id).limit(1).single();
  if (!hh) return NextResponse.json({ error: 'no household' }, { status: 400 });
  const plan = await getOrCreatePlan(supabase, hh.household_id, weekStart);
  return NextResponse.json(await getWeekPlan(supabase, plan.id));
}
```

`src/app/api/plans/[id]/slots/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { upsertSlot } from '@/lib/db/plans';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const body = await req.json();
  try {
    return NextResponse.json(await upsertSlot(supabase, { ...body, plan_id: id }), { status: 200 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
```

`src/app/api/plans/[id]/slots/[slotId]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { deleteSlot } from '@/lib/db/plans';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; slotId: string }> }) {
  const { slotId } = await params;
  const supabase = await createServerSupabase();
  try { await deleteSlot(supabase, slotId); return new NextResponse(null, { status: 204 }); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
```

- [ ] **Step 3: Test FK — usunięcie przepisu nie kasuje slotu**

W Supabase SQL Editor:
```sql
insert into plans (household_id, week_start_date) values ('<hh>', '2026-09-21');
insert into plan_slots (plan_id, date, position, recipe_id, servings)
  values ('<plan>', '2026-09-21', 0, '<recipe>', 2);
delete from recipes where id = '<recipe>';
select * from plan_slots; -- slot istnieje, recipe_id = NULL
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(plans): API for week plan and slots"
```

---

## Task 10: Plan tygodnia — UI (desktop + mobile)

**Files:**
- Create: `src/components/plan/WeekPlan.tsx`, `WeekPlanDesktop.tsx`, `WeekPlanMobile.tsx`, `PlanSlot.tsx`, `DayMacroSummary.tsx`, `src/hooks/usePlan.ts`, `src/app/(app)/plan/page.tsx`

**Interfaces:**
- Consumes: `getWeekPlan`, `upsertSlot` (Task 9), `calculateIngredientMacros`, `sumMacros` (Task 6).
- Produces: strona `/plan` z nawigacją tygodniową, dodawanie/usuwanie slotów, makro per dzień.

- [ ] **Step 1: `usePlan`**

`src/hooks/usePlan.ts`:
```typescript
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PlanWithSlots } from '@/lib/db/plans';

export function usePlan(weekStart: string) {
  const [plan, setPlan] = useState<PlanWithSlots | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/plans?week=${weekStart}`);
    if (r.ok) setPlan(await r.json());
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { reload(); }, [reload]);

  async function assign(date: string, position: number, recipeId: string | null, servings: number) {
    if (!plan) return;
    await fetch(`/api/plans/${plan.id}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, position, label: null, recipe_id: recipeId, servings }),
    });
    await reload();
  }

  async function remove(slotId: string) {
    if (!plan) return;
    await fetch(`/api/plans/${plan.id}/slots/${slotId}`, { method: 'DELETE' });
    await reload();
  }

  return { plan, loading, assign, remove, reload };
}
```

- [ ] **Step 2: `DayMacroSummary` i `PlanSlot`**

`src/components/plan/DayMacroSummary.tsx`:
```tsx
import type { Macros } from '@/lib/types';
import { MacroSummary } from '@/components/recipes/MacroSummary';

export function DayMacroSummary({ macros }: { macros: Macros | null }) {
  return (
    <div className="text-xs text-gray-600 border-t pt-1 mt-1">
      <MacroSummary macros={macros} />
    </div>
  );
}
```

`src/components/plan/PlanSlot.tsx`:
```tsx
'use client';

export function PlanSlot({
  label, recipeName, onRemove,
}: { label: string; recipeName: string | null; onRemove?: () => void }) {
  return (
    <div className="border rounded p-2 bg-white text-sm min-h-[48px] flex justify-between items-start">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div>{recipeName ?? <span className="text-gray-400 italic">puste</span>}</div>
      </div>
      {onRemove && recipeName && (
        <button onClick={onRemove} className="text-red-600 text-xs">×</button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `WeekPlanDesktop`**

`src/components/plan/WeekPlanDesktop.tsx`:
```tsx
'use client';
import { addDays, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { PlanWithSlots } from '@/lib/db/plans';
import { PlanSlot } from './PlanSlot';

const POSITIONS = [0, 1, 2, 3, 4];
const LABELS = ['śniadanie', 'lunch', 'obiad', 'przekąska', 'kolacja'];

export function WeekPlanDesktop({
  plan, onAdd, onRemove,
}: {
  plan: PlanWithSlots;
  onAdd: (date: string, position: number) => void;
  onRemove: (slotId: string) => void;
}) {
  const start = new Date(plan.week_start_date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2"></th>
            {days.map((d) => (
              <th key={d.toISOString()} className="border p-2 text-sm">
                {format(d, 'EEE d.MM', { locale: pl })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POSITIONS.map((pos) => (
            <tr key={pos}>
              <td className="border p-2 text-xs text-gray-500">{LABELS[pos]}</td>
              {days.map((d) => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const slot = plan.slots.find((s) => s.date === dateStr && s.position === pos);
                return (
                  <td key={dateStr + pos} className="border p-1 align-top w-32">
                    {slot ? (
                      <PlanSlot
                        label={LABELS[pos]}
                        recipeName={slot.recipe?.name ?? (slot.recipe_id ? 'przepis usunięty' : null)}
                        onRemove={() => onRemove(slot.id)}
                      />
                    ) : (
                      <button onClick={() => onAdd(dateStr, pos)}
                        className="w-full h-full text-gray-300 hover:text-green-600 text-xl">+</button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: `WeekPlanMobile`**

`src/components/plan/WeekPlanMobile.tsx`:
```tsx
'use client';
import { addDays, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { PlanWithSlots } from '@/lib/db/plans';
import { PlanSlot } from './PlanSlot';
import { DayMacroSummary } from './DayMacroSummary';

export function WeekPlanMobile({
  plan, onAdd, onRemove, dayMacros,
}: {
  plan: PlanWithSlots;
  onAdd: (date: string, position: number) => void;
  onRemove: (slotId: string) => void;
  dayMacros: Record<string, import('@/lib/types').Macros | null>;
}) {
  const start = new Date(plan.week_start_date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="p-3 space-y-4">
      {days.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const slots = plan.slots.filter((s) => s.date === dateStr).sort((a, b) => a.position - b.position);
        const maxPos = slots.length > 0 ? Math.max(...slots.map((s) => s.position)) + 1 : 0;
        return (
          <section key={dateStr} className="border rounded p-3">
            <h3 className="font-semibold mb-2">{format(d, 'EEEE d MMMM', { locale: pl })}</h3>
            <div className="space-y-2">
              {slots.map((s) => (
                <PlanSlot
                  key={s.id}
                  label={s.label ?? `posiłek ${s.position + 1}`}
                  recipeName={s.recipe?.name ?? (s.recipe_id ? 'przepis usunięty' : null)}
                  onRemove={() => onRemove(s.id)}
                />
              ))}
              <button onClick={() => onAdd(dateStr, maxPos)}
                className="w-full text-sm text-green-700 border border-dashed rounded py-1">
                + dodaj posiłek
              </button>
            </div>
            <DayMacroSummary macros={dayMacros[dateStr] ?? null} />
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: `WeekPlan` (router po szerokości) + strona**

`src/components/plan/WeekPlan.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { usePlan } from '@/hooks/usePlan';
import { WeekPlanDesktop } from './WeekPlanDesktop';
import { WeekPlanMobile } from './WeekPlanMobile';
import { calculateIngredientMacros, sumMacros } from '@/lib/macros';
import type { Macros } from '@/lib/types';

export function WeekPlan({ weekStart }: { weekStart: string }) {
  const { plan, loading, assign, remove, reload } = usePlan(weekStart);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pickerFor, setPickerFor] = useState<{ date: string; position: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  async function handlePick(recipeId: string) {
    if (!pickerFor) return;
    await assign(pickerFor.date, pickerFor.position, recipeId, 1);
    setPickerFor(null);
  }

  if (loading || !plan) return <p className="p-4">Ładuję plan…</p>;

  const dayMacros: Record<string, Macros | null> = {};
  for (const slot of plan.slots) {
    if (!slot.recipe) continue;
    // szczegóły przepisu nie są tu w pełni dostępne; pobierz per slot asynchronicznie w przyszłej iteracji
    dayMacros[slot.date] = dayMacros[slot.date] ?? null;
  }

  const commonProps = { plan, onAdd: (d: string, p: number) => setPickerFor({ date: d, position: p }), onRemove: remove };

  return (
    <div>
      <div className="p-3 flex justify-between items-center">
        <button onClick={() => reload()}>Odśwież</button>
        <h2 className="font-semibold">Tydzień od {weekStart}</h2>
      </div>
      {isDesktop
        ? <WeekPlanDesktop {...commonProps} />
        : <WeekPlanMobile {...commonProps} dayMacros={dayMacros} />}
      {pickerFor && (
        <RecipePickerDialog
          date={pickerFor.date}
          onPick={handlePick}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}

function RecipePickerDialog({
  date, onPick, onClose,
}: { date: string; onPick: (id: string) => void; onClose: () => void }) {
  const [recipes, setRecipes] = useState<Array<{ id: string; name: string }>>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/recipes').then((r) => r.json()).then(setRecipes).catch(() => {});
  }, []);

  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-xl w-full md:max-w-md p-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-2">Wybierz przepis na {date}</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj…"
          className="w-full border rounded px-3 py-2 mb-2" />
        <ul className="divide-y">
          {filtered.map((r) => (
            <li key={r.id}>
              <button className="w-full text-left py-2" onClick={() => onPick(r.id)}>{r.name}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

`src/app/(app)/plan/page.tsx`:
```tsx
import { startOfWeek, format } from 'date-fns';
import { WeekPlan } from '@/components/plan/WeekPlan';

export default function PlanPage() {
  const week = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return <WeekPlan weekStart={week} />;
}
```

- [ ] **Step 6: Test manualny + commit**

```bash
pnpm dev
# /plan — dodaj przepis do slotu, sprawdź w Supabase, sprawdź mobile (DevTools)
git add -A
git commit -m "feat(plan): week plan UI (desktop grid + mobile list)"
```

---

## Task 11: Lista zakupów — agregacja (czyste funkcje)

**Files:**
- Create: `src/lib/shopping-list.ts`, `tests/unit/shopping-list.test.ts`

**Interfaces:**
- Consumes: `ShoppingItem` (Task 2), `calculateIngredientMacros` (Task 6).
- Produces: `aggregateShoppingList(planned: PlannedRecipe[]): ShoppingItem[]`.

- [ ] **Step 1: Failing test**

`tests/unit/shopping-list.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { aggregateShoppingList, type PlannedRecipe } from '@/lib/shopping-list';

const recipe = (over: Partial<PlannedRecipe> = {}): PlannedRecipe => ({
  recipe_id: 'r1', servings: 4, base_servings: 2,
  ingredients: [{
    ingredient_id: 'i1', ingredient_name: 'cebula', category: 'warzywa',
    amount: 100, unit: 'g', raw_text: '100 g cebuli', has_macros: true,
  }],
  ...over,
});

describe('aggregateShoppingList', () => {
  it('scales by servings ratio', () => {
    const out = aggregateShoppingList([recipe()]);
    expect(out[0].total_amount).toBe(200);
  });

  it('aggregates same ingredient in same unit', () => {
    const out = aggregateShoppingList([
      { ...recipe(), servings: 2, base_servings: 2 },
      { ...recipe(), servings: 2, base_servings: 2 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].total_amount).toBe(200);
    expect(out[0].raw_amounts).toHaveLength(2);
  });

  it('does NOT sum same ingredient in different units', () => {
    const out = aggregateShoppingList([
      recipe(),
      { ...recipe(), ingredients: [{
        ingredient_id: 'i1', ingredient_name: 'oliwa', category: 'tluszcze',
        amount: 2, unit: 'łyżka', raw_text: '2 łyżki oliwy', has_macros: false,
      }] },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((x) => x.unit === 'g')?.total_amount).toBe(200);
    expect(out.find((x) => x.unit === 'łyżka')?.total_amount).toBe(4);
  });

  it('marks incomplete when macros missing', () => {
    const out = aggregateShoppingList([
      recipe({ ingredients: [{
        ingredient_id: 'i1', ingredient_name: 'x', category: 'inne',
        amount: 100, unit: 'g', raw_text: '100 g', has_macros: false,
      }] }),
    ]);
    expect(out[0].incomplete).toBe(true);
  });
});
```

- [ ] **Step 2: Uruchom — fail**

```bash
pnpm test tests/unit/shopping-list.test.ts
```

- [ ] **Step 3: Implementuj**

`src/lib/shopping-list.ts`:
```typescript
import type { ShoppingItem, IngredientCategory } from './types';

export interface PlannedIngredient {
  ingredient_id: string;
  ingredient_name: string;
  category: IngredientCategory;
  amount: number | null;
  unit: string | null;
  raw_text: string;
  has_macros: boolean;
}

export interface PlannedRecipe {
  recipe_id: string;
  servings: number;
  base_servings: number;
  ingredients: PlannedIngredient[];
}

export function aggregateShoppingList(planned: PlannedRecipe[]): ShoppingItem[] {
  const groups = new Map<string, ShoppingItem>();

  for (const recipe of planned) {
    const factor = recipe.base_servings > 0 ? recipe.servings / recipe.base_servings : 1;
    for (const ing of recipe.ingredients) {
      const key = `${ing.ingredient_id}::${ing.unit ?? 'none'}`;
      const scaled = ing.amount !== null ? ing.amount * factor : null;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          ingredient_id: ing.ingredient_id,
          ingredient_name: ing.ingredient_name,
          category: ing.category,
          unit: ing.unit,
          total_amount: scaled,
          raw_amounts: [ing.raw_text],
          have_it: false,
          incomplete: !ing.has_macros,
        });
      } else {
        if (scaled !== null && existing.total_amount !== null) existing.total_amount += scaled;
        else if (scaled !== null) existing.total_amount = scaled;
        existing.raw_amounts.push(ing.raw_text);
        existing.incomplete = existing.incomplete || !ing.has_macros;
      }
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.ingredient_name.localeCompare(b.ingredient_name);
  });
}
```

- [ ] **Step 4: PASS + commit**

```bash
pnpm test tests/unit/shopping-list.test.ts
git add -A
git commit -m "feat(shopping): aggregation logic (pure)"
```

---

## Task 12: Lista zakupów — UI + offline + spiżarnia

**Files:**
- Create: `src/lib/offline/shopping-store.ts`, `src/components/shopping/ShoppingList.tsx`, `ShoppingItem.tsx`, `CategoryGroup.tsx`, `src/app/(app)/shopping/page.tsx`, `src/hooks/useShoppingList.ts`, `src/app/api/shopping/route.ts`

**Interfaces:**
- Consumes: `aggregateShoppingList` (Task 11), `getWeekPlan` (Task 9), `getRecipe` (Task 7), `idb` z Task 1.
- Produces: `GET /api/shopping?week=` zwraca zagregowaną listę; strona `/shopping` z offline storage.

- [ ] **Step 1: API agregacji**

`src/app/api/shopping/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getOrCreatePlan, getWeekPlan } from '@/lib/db/plans';
import { getRecipe } from '@/lib/db/recipes';
import { aggregateShoppingList, type PlannedRecipe } from '@/lib/shopping-list';
import type { IngredientCategory } from '@/lib/types';

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
  const week = new URL(req.url).searchParams.get('week');
  if (!week) return NextResponse.json({ error: 'week required' }, { status: 400 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { data: hh } = await supabase.from('household_members')
    .select('household_id').eq('user_id', user.id).limit(1).single();
  if (!hh) return NextResponse.json({ error: 'no household' }, { status: 400 });

  const plan = await getOrCreatePlan(supabase, hh.household_id, week);
  const full = await getWeekPlan(supabase, plan.id);

  const planned: PlannedRecipe[] = [];
  for (const slot of full.slots) {
    if (!slot.recipe_id) continue;
    const r = await getRecipe(supabase, slot.recipe_id);
    planned.push({
      recipe_id: r.id,
      servings: slot.servings,
      base_servings: r.servings_base,
      ingredients: r.ingredients.map((ri) => ({
        ingredient_id: ri.ingredient_id,
        ingredient_name: ri.ingredients?.name ?? ri.raw_text,
        category: (ri.ingredients?.category ?? 'inne') as IngredientCategory,
        amount: ri.amount,
        unit: ri.unit,
        raw_text: ri.raw_text,
        has_macros: !!(ri.ingredients?.kcal_per_100g != null || ri.ingredients?.protein_per_100g != null),
      })),
    });
  }
  return NextResponse.json(aggregateShoppingList(planned));
}
```

- [ ] **Step 2: Offline store**

`src/lib/offline/shopping-store.ts`:
```typescript
import { openDB, type IDBPDatabase } from 'idb';
import type { ShoppingItem } from '@/lib/types';

const DB_NAME = 'meal-planner';
const STORE = 'shopping-list';

interface DB {
  [STORE]: { key: string; value: { week: string; items: ShoppingItem[]; have: Record<string, boolean> } };
}

async function db(): Promise<IDBPDatabase<unknown>> {
  return openDB(DB_NAME, 1, {
    upgrade(d) { if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'week' }); },
  });
}

export async function saveShoppingList(week: string, items: ShoppingItem[]) {
  const d = await db();
  await d.put(STORE, { week, items, have: {} });
}

export async function loadShoppingList(week: string): Promise<ShoppingItem[] | null> {
  const d = await db();
  const row = await d.get(STORE, week) as { items: ShoppingItem[] } | undefined;
  return row?.items ?? null;
}

export async function setHave(week: string, ingredientId: string, unit: string | null, have: boolean) {
  const d = await db();
  const row = await d.get(STORE, week) as { have: Record<string, boolean> } | undefined;
  const key = `${ingredientId}::${unit ?? 'none'}`;
  const haveMap = row?.have ?? {};
  haveMap[key] = have;
  await d.put(STORE, { ...(row as object), week, have: haveMap });
}

export async function getHaveMap(week: string): Promise<Record<string, boolean>> {
  const d = await db();
  const row = await d.get(STORE, week) as { have: Record<string, boolean> } | undefined;
  return row?.have ?? {};
}
```

- [ ] **Step 3: Hook + komponenty**

`src/hooks/useShoppingList.ts`:
```typescript
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ShoppingItem } from '@/lib/types';
import { loadShoppingList, saveShoppingList, setHave, getHaveMap } from '@/lib/offline/shopping-store';

export function useShoppingList(week: string) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [have, setHaveMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);

  const load = useCallback(async () => {
    setLoading(true);
    const cached = await loadShoppingList(week);
    if (cached) setItems(cached);
    const haveMap = await getHaveMap(week);
    setHaveMap(haveMap);
    if (navigator.onLine) {
      const r = await fetch(`/api/shopping?week=${week}`);
      if (r.ok) {
        const fresh: ShoppingItem[] = await r.json();
        setItems(fresh);
        await saveShoppingList(week, fresh);
      }
    }
    setLoading(false);
  }, [week]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const on = () => { setOffline(false); load(); };
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load]);

  async function toggleHave(item: ShoppingItem) {
    const key = `${item.ingredient_id}::${item.unit ?? 'none'}`;
    const next = !have[key];
    setHaveMap({ ...have, [key]: next });
    await setHave(week, item.ingredient_id, item.unit, next);
  }

  return { items, have, loading, offline, toggleHave, reload: load };
}
```

`src/components/shopping/ShoppingItem.tsx`:
```tsx
'use client';
import type { ShoppingItem as Item } from '@/lib/types';

export function ShoppingItem({
  item, have, onToggle,
}: { item: Item; have: boolean; onToggle: () => void }) {
  const amount = item.total_amount !== null
    ? `${Math.round(item.total_amount * 100) / 100}${item.unit ? ' ' + item.unit : ''}`
    : item.raw_amounts.join(' + ');
  return (
    <label className="flex items-center gap-3 py-2 border-b last:border-0">
      <input type="checkbox" checked={have} onChange={onToggle} className="w-5 h-5" />
      <span className={have ? 'line-through text-gray-400' : ''}>
        <strong>{item.ingredient_name}</strong>
        {item.incomplete && <span className="ml-1 text-xs text-amber-600">(brak makro)</span>}
      </span>
      <span className="ml-auto text-sm text-gray-600">{amount}</span>
    </label>
  );
}
```

`src/components/shopping/CategoryGroup.tsx`:
```tsx
'use client';
import type { ShoppingItem as Item } from '@/lib/types';
import { ShoppingItem } from './ShoppingItem';

const LABELS: Record<string, string> = {
  warzywa: 'Warzywa', owoce: 'Owoce', mieso: 'Mięso', ryby: 'Ryby',
  nabial: 'Nabiał', pieczywo: 'Pieczywo', makarony: 'Makarony',
  przyprawy: 'Przyprawy', tluszcze: 'Tłuszcze', napoje: 'Napoje', inne: 'Inne',
};

export function CategoryGroup({
  category, items, have, onToggle,
}: {
  category: string; items: Item[]; have: Record<string, boolean>;
  onToggle: (item: Item) => void;
}) {
  return (
    <section className="mb-4">
      <h3 className="font-semibold text-sm uppercase text-gray-500 mb-1">{LABELS[category] ?? category}</h3>
      <div className="border rounded">
        {items.map((it) => (
          <ShoppingItem
            key={`${it.ingredient_id}-${it.unit ?? 'none'}`}
            item={it}
            have={!!have[`${it.ingredient_id}::${it.unit ?? 'none'}`]}
            onToggle={() => onToggle(it)}
          />
        ))}
      </div>
    </section>
  );
}
```

`src/components/shopping/ShoppingList.tsx`:
```tsx
'use client';
import { useShoppingList } from '@/hooks/useShoppingList';
import { CategoryGroup } from './CategoryGroup';

export function ShoppingList({ week }: { week: string }) {
  const { items, have, loading, offline, toggleHave } = useShoppingList(week);
  if (loading && items.length === 0) return <p className="p-4">Ładuję…</p>;

  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

  return (
    <div className="p-4 pb-24">
      {offline && <div className="bg-amber-100 text-amber-900 text-sm p-2 rounded mb-3">Tryb offline — zmiany zsynchronizują się po powrocie online</div>}
      {Object.entries(grouped).map(([cat, list]) => (
        <CategoryGroup key={cat} category={cat} items={list} have={have} onToggle={toggleHave} />
      ))}
    </div>
  );
}
```

`src/app/(app)/shopping/page.tsx`:
```tsx
import { startOfWeek, format } from 'date-fns';
import { ShoppingList } from '@/components/shopping/ShoppingList';

export default function ShoppingPage() {
  const week = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return <div><h1 className="text-2xl font-bold p-4">Zakupy</h1><ShoppingList week={week} /></div>;
}
```

- [ ] **Step 4: Test manualny**

```bash
pnpm dev
# /shopping — sprawdź że lista się agreguje, kliknij checkbox
# DevTools → Network → Offline → odśwież — lista z cache, checkboxy działają
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(shopping): list UI with offline support and pantry checkboxes"
```

---

## Task 13: Gospodarstwo + udostępnianie linkiem

**Files:**
- Create: `src/lib/db/households.ts`, `src/lib/share-token.ts`, `src/app/api/household/invite/route.ts`, `src/app/api/share/[token]/route.ts`, `src/app/share/[token]/page.tsx`, `src/app/(app)/settings/page.tsx`, `tests/unit/share-token.test.ts`

**Interfaces:**
- Consumes: Supabase (Task 4).
- Produces: `generateShareToken()`, `createShareToken(supabase, planId, userId)`, strona `/share/[token]` read-only, zaproszenia do gospodarstwa.

- [ ] **Step 1: Failing test — token**

`tests/unit/share-token.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateShareToken } from '@/lib/share-token';

describe('generateShareToken', () => {
  it('returns 32-char url-safe string', () => {
    const t = generateShareToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
  it('is unique across calls', () => {
    const set = new Set(Array.from({ length: 100 }, generateShareToken));
    expect(set.size).toBe(100);
  });
});
```

- [ ] **Step 2: Implementuj**

`src/lib/share-token.ts`:
```typescript
export function generateShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    .slice(0, 32);
}
```

Uruchom `pnpm test tests/unit/share-token.test.ts` → PASS.

- [ ] **Step 3: DB + API**

`src/lib/db/households.ts`:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateShareToken } from '@/lib/share-token';

export async function createShareToken(supabase: SupabaseClient, planId: string, userId: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = generateShareToken();
    const { error } = await supabase.from('share_tokens').insert({ token, plan_id: planId, created_by: userId });
    if (!error) return token;
  }
  throw new Error('could not generate unique token');
}

export async function inviteMember(supabase: SupabaseClient, householdId: string, email: string) {
  const { data: userRow } = await supabase.from('household_members')
    .select('household_id').eq('household_id', householdId).limit(1).single();
  if (!userRow) throw new Error('not a member');
  // Zaproszenie: tworzymy wiersz dopiero gdy user istnieje. W v1 zakładamy, że email już ma konto.
  const { error } = await supabase.from('household_members')
    .insert({ household_id: householdId, user_id: email, role: 'member' });
  if (error) throw error;
}
```

`src/app/api/share/[token]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getWeekPlan } from '@/lib/db/plans';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabase();
  const { data: st } = await supabase.from('share_tokens').select('plan_id').eq('token', token).single();
  if (!st) return NextResponse.json({ error: 'invalid token' }, { status: 404 });
  const plan = await getWeekPlan(supabase, st.plan_id);
  return NextResponse.json(plan);
}
```

- [ ] **Step 4: Strona share + settings**

`src/app/share/[token]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getWeekPlan } from '@/lib/db/plans';

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabase();
  const { data: st } = await supabase.from('share_tokens').select('plan_id').eq('token', token).maybeSingle();
  if (!st) notFound();
  const plan = await getWeekPlan(supabase, st.plan_id);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Plan tygodnia od {plan.week_start_date}</h1>
      <ul className="space-y-2">
        {plan.slots
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
          .map((s) => (
            <li key={s.id} className="border rounded p-2">
              <span className="text-xs text-gray-500">{s.date} · {s.label ?? `posiłek ${s.position + 1}`}</span>
              <div>{s.recipe?.name ?? '—'}</div>
            </li>
          ))}
      </ul>
    </div>
  );
}
```

`src/app/(app)/settings/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateShare() {
    setLoading(true);
    // W v1: plan bieżącego tygodnia
    const week = new Date().toISOString().slice(0, 10);
    const r = await fetch('/api/plans?week=' + week);
    if (!r.ok) { setLoading(false); return; }
    const plan = await r.json();
    const tr = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: plan.id }),
    });
    if (tr.ok) {
      const { token } = await tr.json();
      setShareUrl(`${window.location.origin}/share/${token}`);
    }
    setLoading(false);
  }

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Ustawienia</h1>
      <section>
        <h2 className="font-semibold mb-2">Udostępnij plan</h2>
        <button onClick={generateShare} disabled={loading} className="bg-green-600 text-white rounded px-3 py-2">
          {loading ? '…' : 'Wygeneruj link'}
        </button>
        {shareUrl && (
          <div className="mt-2 text-sm break-all bg-gray-100 p-2 rounded">
            <a href={shareUrl}>{shareUrl}</a>
          </div>
        )}
      </section>
      <button onClick={logout} className="text-red-600">Wyloguj</button>
    </div>
  );
}
```

Dodaj endpoint `POST /api/share`:

`src/app/api/share/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createShareToken } from '@/lib/db/households';

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  const { plan_id } = await req.json();
  try {
    const token = await createShareToken(supabase, plan_id, user.id);
    return NextResponse.json({ token });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 400 }); }
}
```

- [ ] **Step 5: Test + commit**

```bash
pnpm test tests/unit/share-token.test.ts
pnpm dev
# Wygeneruj link, otwórz w trybie incognito (bez logowania) → plan widoczny read-only
git add -A
git commit -m "feat(sharing): read-only share links + settings page"
```

---

## Task 14: Import — fetch + clean + Markdown

**Files:**
- Create: `src/lib/import/fetch.ts`, `src/lib/import/clean.ts`, `tests/unit/import/clean.test.ts`, `tests/fixtures/jadlonomia/sample.html`, `tests/fixtures/aniagotuje/sample.html`

**Interfaces:**
- Consumes: `cheerio`, `turndown` (Task 1).
- Produces: `fetchPage(url): Promise<string>` (HTML), `cleanHtml(html): string` (Markdown).

- [ ] **Step 1: Fixtures — zapisz 2 realne HTML-e**

Zapisz ręcznie (curl + zapis) do `tests/fixtures/jadlonomia/sample.html` i `tests/fixtures/aniagotuje/sample.html`. Wybierz proste przepisy (np. zupa).

```bash
curl -A "Mozilla/5.0" "https://www.jadlonomia.com/przepisy/..." > tests/fixtures/jadlonomia/sample.html
curl -A "Mozilla/5.0" "https://aniagotuje.pl/przepis/..." > tests/fixtures/aniagotuje/sample.html
```

- [ ] **Step 2: Failing test**

`tests/unit/import/clean.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanHtml } from '@/lib/import/clean';

describe('cleanHtml', () => {
  it('removes scripts, styles, nav, footer', () => {
    const md = cleanHtml('<html><head><style>x</style></head><body><nav>n</nav><article><h1>T</h1><p>Body</p></article><footer>f</footer></body></html>');
    expect(md).toContain('T');
    expect(md).toContain('Body');
    expect(md).not.toContain('<style>');
    expect(md).not.toContain('footer');
  });

  it('extracts article content from jadlonomia fixture', () => {
    const html = readFileSync('tests/fixtures/jadlonomia/sample.html', 'utf8');
    const md = cleanHtml(html);
    expect(md.length).toBeGreaterThan(100);
    expect(md).not.toMatch(/<script/i);
  });

  it('extracts article content from aniagotuje fixture', () => {
    const html = readFileSync('tests/fixtures/aniagotuje/sample.html', 'utf8');
    const md = cleanHtml(html);
    expect(md.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 3: Implementuj**

`src/lib/import/fetch.ts`:
```typescript
export async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MealPlanner/1.0)' },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return await res.text();
}
```

`src/lib/import/clean.ts`:
```typescript
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

const CONTENT_SELECTORS = [
  'article[itemtype*="Recipe"]',
  '.article-content',
  '.entry-content',
  '.recipe-content',
  'main article',
  'article',
  'main',
];

export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside, iframe, noscript, svg').remove();
  $('[class*="ad-"], [class*="advert"], [id*="cookie"]').remove();

  let content = '';
  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      content = el.html() ?? '';
      break;
    }
  }
  if (!content) content = $('body').html() ?? '';
  return turndown.turndown(content).trim();
}
```

- [ ] **Step 4: PASS + commit**

```bash
pnpm test tests/unit/import/clean.test.ts
git add -A
git commit -m "feat(import): HTML fetch + clean to Markdown with fixtures"
```

---

## Task 15: Import — WebLLM worker + ekstrakcja

**Files:**
- Create: `src/lib/import/worker.ts`, `src/lib/import/engine.ts`, `src/lib/import/extract.ts`, `src/lib/import/schema.ts`, `tests/unit/import/extract.test.ts`

**Interfaces:**
- Consumes: `RecipeJsonLdSchema` (Task 2), `@mlc-ai/web-llm` (Task 1).
- Produces: `extractRecipeFromMarkdown(md, url): Promise<RecipeJsonLd>`, `extractRecipeBrowser(md)` (WebLLM), `extractRecipeServer(md)` (Gemini fallback, Task 17).

- [ ] **Step 1: Prompt + parser**

`src/lib/import/schema.ts`:
```typescript
import { RecipeJsonLdSchema, type RecipeJsonLd } from '@/lib/schemas';

export const SYSTEM_PROMPT = `Jesteś ekstraktorem przepisów kulinarnych. Otrzymasz treść strony w Markdown. Zwróć WYŁĄCZNIE obiekt JSON zgodny z poniższym schematem, bez komentarzy i bez znaczników code fence:

{
  "name": string (wymagane, min 1 znak),
  "recipeIngredient": string[] (lista składników, każdy jako pojedynczy string),
  "recipeInstructions": string[] (kroki jako lista stringów),
  "recipeYield": string | number | undefined (np. "4 porcje"),
  "prepTime": string | undefined (ISO 8601 duration, np. "PT20M"),
  "image": string | undefined (URL)
}

Jeśli pole jest nieobecne, pomiń je. Nie halucynuj.`;

export function parseLlmJson(raw: string): RecipeJsonLd {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const obj = JSON.parse(text);
  return RecipeJsonLdSchema.parse(obj);
}
```

- [ ] **Step 2: Worker WebLLM**

`src/lib/import/worker.ts`:
```typescript
/// <reference lib="webworker" />
import { CreateWebWorkerMLCEngine, type WebWorkerMLCEngine } from '@mlc-ai/web-llm';

let engine: WebWorkerMLCEngine | null = null;

const MODEL_ID = 'gemma-2-2b-it-q4f16_1-MLC';

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;
  try {
    if (type === 'init') {
      if (!engine) {
        engine = await CreateWebWorkerMLCEngine(self, MODEL_ID, {
          initProgressCallback: (p) => self.postMessage({ type: 'progress', progress: p }),
        });
      }
      self.postMessage({ id, ok: true });
      return;
    }
    if (type === 'extract') {
      if (!engine) throw new Error('engine not initialized');
      const chunks = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: payload.system },
          { role: 'user', content: payload.user },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      });
      self.postMessage({ id, ok: true, text: chunks.choices[0]?.message?.content ?? '' });
      return;
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
```

- [ ] **Step 3: Engine wrapper (main thread)**

`src/lib/import/engine.ts`:
```typescript
'use client';
import { SYSTEM_PROMPT, parseLlmJson } from './schema';
import type { RecipeJsonLd } from '@/lib/schemas';

let worker: Worker | null = null;
let counter = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const { id, ok, text, error } = e.data;
    if (id == null) return;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    ok ? p.resolve(text) : p.reject(new Error(error));
  };
  return worker;
}

function call<T>(type: string, payload: unknown): Promise<T> {
  const w = getWorker();
  const id = ++counter;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ id, type, payload });
  });
}

export async function ensureEngineReady(onProgress?: (p: unknown) => void) {
  const w = getWorker();
  if (onProgress) {
    w.addEventListener('message', (e) => {
      if (e.data.type === 'progress') onProgress(e.data.progress);
    });
  }
  await call('init', null);
}

export async function extractWithWebLlm(markdown: string): Promise<RecipeJsonLd> {
  const raw = await call<string>('extract', { system: SYSTEM_PROMPT, user: markdown });
  return parseLlmJson(raw);
}

export function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}
```

- [ ] **Step 4: Orkiestrator z retry**

`src/lib/import/extract.ts`:
```typescript
import { parseLlmJson } from './schema';
import type { RecipeJsonLd } from '@/lib/schemas';

export type LlmFn = (system: string, user: string) => Promise<string>;

export async function extractRecipe(
  markdown: string,
  llm: LlmFn,
  systemPrompt: string,
  maxRetries = 2
): Promise<RecipeJsonLd> {
  let lastError = '';
  for (let i = 0; i <= maxRetries; i++) {
    const user = i === 0
      ? markdown
      : `${markdown}\n\nUWAGA: poprzednia odpowiedź nie pasowała do schematu (${lastError}). Spróbuj ponownie, zwróć TYLKO poprawny JSON.`;
    const raw = await llm(systemPrompt, user);
    try { return parseLlmJson(raw); }
    catch (e) { lastError = String(e); }
  }
  throw new Error(`LLM failed to produce valid recipe: ${lastError}`);
}
```

- [ ] **Step 5: Failing test — walidacja odrzuca śmieci**

`tests/unit/import/extract.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { extractRecipe, type LlmFn } from '@/lib/import/extract';
import { SYSTEM_PROMPT } from '@/lib/import/schema';

describe('extractRecipe', () => {
  it('returns parsed recipe on valid JSON', async () => {
    const llm: LlmFn = async () => JSON.stringify({
      name: 'Zupa', recipeIngredient: ['x'], recipeInstructions: ['y'],
    });
    const r = await extractRecipe('md', llm, SYSTEM_PROMPT);
    expect(r.name).toBe('Zupa');
  });

  it('retries on invalid JSON and succeeds', async () => {
    let n = 0;
    const llm: LlmFn = async () => {
      n++;
      if (n === 1) return 'not json';
      return JSON.stringify({ name: 'OK', recipeIngredient: ['a'], recipeInstructions: ['b'] });
    };
    const r = await extractRecipe('md', llm, SYSTEM_PROMPT);
    expect(r.name).toBe('OK');
    expect(n).toBe(2);
  });

  it('throws after max retries on garbage', async () => {
    const llm: LlmFn = async () => 'to nie jest przepis';
    await expect(extractRecipe('md', llm, SYSTEM_PROMPT, 1)).rejects.toThrow();
  });

  it('rejects JSON without name (Review Focus #3)', async () => {
    const llm: LlmFn = async () => JSON.stringify({ recipeIngredient: [], recipeInstructions: [] });
    await expect(extractRecipe('md', llm, SYSTEM_PROMPT, 0)).rejects.toThrow();
  });
});
```

- [ ] **Step 6: PASS + commit**

```bash
pnpm test tests/unit/import/extract.test.ts
git add -A
git commit -m "feat(import): WebLLM worker, extraction with validation and retry"
```

---

## Task 16: Import — UI (dialog + formularz zatwierdzenia)

**Files:**
- Create: `src/components/import/ImportDialog.tsx`, `src/components/import/ImportReviewForm.tsx`, `src/app/api/import/fetch/route.ts`

**Interfaces:**
- Consumes: `fetchPage`, `cleanHtml` (Task 14), `ensureEngineReady`, `extractWithWebLlm`, `hasWebGpu` (Task 15), `IngredientPicker` (Task 7).
- Produces: przycisk „Import z URL" w `/recipes/new`, dialog, wypełniony `RecipeForm` po zatwierdzeniu.

- [ ] **Step 1: API fetch (server, omija CORS)**

`src/app/api/import/fetch/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { fetchPage } from '@/lib/import/fetch';
import { cleanHtml } from '@/lib/import/clean';

export async function POST(req: Request) {
  const { url } = await req.json();
  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'url required' }, { status: 400 });
  try {
    const html = await fetchPage(url);
    const markdown = cleanHtml(html);
    return NextResponse.json({ markdown });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Dialog importu**

`src/components/import/ImportDialog.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { ensureEngineReady, extractWithWebLlm, hasWebGpu } from '@/lib/import/engine';
import type { RecipeJsonLd } from '@/lib/schemas';

export function ImportDialog({
  onClose, onExtracted,
}: { onClose: () => void; onExtracted: (r: RecipeJsonLd) => void }) {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<'idle' | 'fetch' | 'model' | 'extract' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      setStage('fetch');
      const fr = await fetch('/api/import/fetch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!fr.ok) throw new Error((await fr.json()).error ?? 'fetch failed');
      const { markdown } = await fr.json();

      if (!hasWebGpu()) throw new Error('Brak WebGPU — użyj fallbacku Gemini (skonfiguruj klucz)');

      setStage('model');
      await ensureEngineReady();

      setStage('extract');
      const recipe = await extractWithWebLlm(markdown);
      setStage('done');
      onExtracted(recipe);
    } catch (e) {
      setError(String(e));
      setStage('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Import przepisu z URL</h3>
        <input
          value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.jadlonomia.com/..." type="url"
          className="w-full border rounded px-3 py-2 mb-3"
        />
        <div className="text-sm text-gray-600 mb-2">
          {stage === 'fetch' && 'Pobieram stronę…'}
          {stage === 'model' && 'Ładuję model (pierwszy raz może potrwać 1-2 min)…'}
          {stage === 'extract' && 'Wyciągam przepis…'}
          {stage === 'done' && 'Gotowe'}
        </div>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1">Anuluj</button>
          <button onClick={run} disabled={!url || stage !== 'idle' && stage !== 'error' && stage !== 'done'}
            className="bg-green-600 text-white rounded px-3 py-1">
            Importuj
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Formularz zatwierdzenia**

`src/components/import/ImportReviewForm.tsx`:
```tsx
'use client';
import { useState } from 'react';
import type { RecipeJsonLd } from '@/lib/schemas';
import { IngredientPicker, type PickedIngredient } from '@/components/recipes/IngredientPicker';

export function ImportReviewForm({
  extracted, sourceUrl, onCancel, onSaved,
}: {
  extracted: RecipeJsonLd; sourceUrl: string;
  onCancel: () => void; onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(extracted.name);
  const [servings, setServings] = useState(parseYield(extracted.recipeYield));
  const [ingredients, setIngredients] = useState<PickedIngredient[]>([]);
  const [steps, setSteps] = useState<string[]>(
    Array.isArray(extracted.recipeInstructions)
      ? extracted.recipeInstructions.map((s) => typeof s === 'string' ? s : s.text)
      : [extracted.recipeInstructions as string]
  );
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const res = await fetch('/api/recipes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, servings_base: servings, prep_time_min: null,
        source_url: sourceUrl, visibility: 'household',
        diet_tags: [], allergens: [],
        ingredients: ingredients.map((i) => ({
          ingredient_id: i.ingredient_id, amount: i.amount, unit: i.unit,
          raw_text: i.raw_text, position: i.position,
        })),
        steps: steps.filter((s) => s.trim()).map((text, i) => ({ position: i, text })),
      }),
    });
    if (!res.ok) { setError((await res.json()).error ?? 'save failed'); return; }
    const r = await res.json();
    onSaved(r.id);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <p className="text-sm bg-amber-50 p-2 rounded">
        Sprawdź i uzupełnij dane z importu. Lista składników wymaga mapowania na bazę.
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2" />
      <input type="number" value={servings} min={1} onChange={(e) => setServings(Number(e.target.value))}
        className="w-24 border rounded px-2 py-1" />
      <div>
        <h3 className="font-semibold">Składniki (z importu: {extracted.recipeIngredient.length})</h3>
        <ul className="text-sm text-gray-600 mb-2">
          {extracted.recipeIngredient.map((x, i) => <li key={i}>· {x}</li>)}
        </ul>
        <p className="text-sm text-gray-500 mb-2">Zmapuj na bazę:</p>
        <IngredientPicker value={ingredients} onChange={setIngredients} />
      </div>
      <div>
        <h3 className="font-semibold">Kroki</h3>
        {steps.map((s, i) => (
          <textarea key={i} value={s} onChange={(e) => {
            const n = [...steps]; n[i] = e.target.value; setSteps(n);
          }} className="w-full border rounded px-2 py-1 my-1" />
        ))}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-2 border rounded">Anuluj</button>
        <button onClick={save} className="bg-green-600 text-white rounded px-4 py-2">Zapisz przepis</button>
      </div>
    </div>
  );
}

function parseYield(y: string | number | undefined): number {
  if (typeof y === 'number') return Math.max(1, Math.round(y));
  if (!y) return 4;
  const m = y.match(/(\d+)/);
  return m ? Math.max(1, Number(m[1])) : 4;
}
```

- [ ] **Step 4: Integracja w `/recipes/new`**

Zaktualizuj `src/app/(app)/recipes/new/page.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeForm } from '@/components/recipes/RecipeForm';
import { ImportDialog } from '@/components/import/ImportDialog';
import { ImportReviewForm } from '@/components/import/ImportReviewForm';
import type { RecipeJsonLd } from '@/lib/schemas';

export default function NewRecipePage() {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [extracted, setExtracted] = useState<{ data: RecipeJsonLd; url: string } | null>(null);

  if (extracted) {
    return <ImportReviewForm
      extracted={extracted.data}
      sourceUrl={extracted.url}
      onCancel={() => setExtracted(null)}
      onSaved={(id) => router.push(`/recipes/${id}`)}
    />;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Nowy przepis</h1>
        <button onClick={() => setShowImport(true)} className="text-green-700 border border-green-700 rounded px-3 py-1">
          Import z URL
        </button>
      </div>
      <RecipeForm />
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onExtracted={(data) => {
        setExtracted({ data, url: '' });
        setShowImport(false);
      }} />}
    </div>
  );
}
```

- [ ] **Step 5: Test manualny**

```bash
pnpm dev
# /recipes/new → Import z URL → wklej link jadłonomii → sprawdź że model się ładuje i wyciąga przepis
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(import): review dialog and form integration"
```

---

## Task 17: Import — fallback Gemini

**Files:**
- Create: `src/app/api/import/extract/route.ts`, `src/lib/import/gemini.ts`

**Interfaces:**
- Consumes: `SYSTEM_PROMPT`, `extractRecipe` (Task 15).
- Produces: `POST /api/import/extract` z `{ markdown }` → `RecipeJsonLd`; klient woła gdy `hasWebGpu() === false`.

- [ ] **Step 1: Klient Gemini**

`src/lib/import/gemini.ts`:
```typescript
import { SYSTEM_PROMPT } from './schema';

const MODEL = 'gemini-2.0-flash-exp';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const res = await fetch(`${ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export { SYSTEM_PROMPT };
```

- [ ] **Step 2: API route**

`src/app/api/import/extract/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { extractRecipe } from '@/lib/import/extract';
import { callGemini, SYSTEM_PROMPT } from '@/lib/import/gemini';

export async function POST(req: Request) {
  const { markdown } = await req.json();
  if (!markdown || typeof markdown !== 'string') {
    return NextResponse.json({ error: 'markdown required' }, { status: 400 });
  }
  try {
    const recipe = await extractRecipe(markdown, callGemini, SYSTEM_PROMPT, 2);
    return NextResponse.json(recipe);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
```

- [ ] **Step 3: Fallback w dialogu**

Zaktualizuj `src/components/import/ImportDialog.tsx` — w funkcji `run`, zamiast rzucać błąd przy braku WebGPU:
```tsx
if (!hasWebGpu()) {
  setStage('extract');
  const er = await fetch('/api/import/extract', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
  });
  if (!er.ok) throw new Error((await er.json()).error ?? 'extract failed');
  const recipe = await er.json();
  setStage('done');
  onExtracted(recipe);
  return;
}
```

- [ ] **Step 4: Env var**

W Vercel: dodaj `GEMINI_API_KEY`. Lokalnie: `.env.local` (nie commitowany).

- [ ] **Step 5: Test manualny w Safari/iOS**

Otwórz w Safari (bez WebGPU), sprawdź że fallback działa.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(import): Gemini fallback for browsers without WebGPU"
```

---

## Task 18: Backup + keepalive cron

**Files:**
- Create: `.github/workflows/backup.yml`, `.github/workflows/keepalive.yml`

**Interfaces:**
- Produces: cotygodniowy backup bazy do prywatnego repo GitHuba; ping do Supabase co 5 dni.

- [ ] **Step 1: Keepalive**

`.github/workflows/keepalive.yml`:
```yaml
name: Supabase keepalive
on:
  schedule:
    - cron: '0 6 */5 * *'
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -sf "${{ secrets.SUPABASE_URL }}/rest/v1/ingredients?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" > /dev/null
```

- [ ] **Step 2: Backup**

`.github/workflows/backup.yml`:
```yaml
name: Weekly backup
on:
  schedule:
    - cron: '0 3 * * 0'
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install supabase CLI
        run: |
          curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
            | tar -xz -C /usr/local/bin supabase
      - name: Dump
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          mkdir -p backups
          supabase db dump --db-url "$SUPABASE_DB_URL" -f "backups/backup-$(date +%F).sql"
      - name: Upload
        uses: actions/upload-artifact@v4
        with:
          name: backup-${{ github.run_id }}
          path: backups/
          retention-days: 90
```

- [ ] **Step 3: Sekrety w GitHub**

W repo → Settings → Secrets → Actions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL` (z Supabase → Database → Connection string → URI, service role)

- [ ] **Step 4: Test workflowów**

```bash
gh workflow run keepalive.yml
gh workflow run backup.yml
gh run list --limit 5
```

- [ ] **Step 5: Commit**

```bash
git add .github/
git commit -m "chore(ci): keepalive ping and weekly DB backup"
```

---

## Self-Review

### 1. Spec coverage

| Wymaganie ze spec | Task |
|---|---|
| Własna baza przepisów | 7, 8 |
| Dodawanie ręczne | 7 |
| Import z URL (jadłonomia, aniagotuje) | 14, 15, 16, 17 |
| Planowanie zakupów | 11, 12 |
| Plan tygodnia | 9, 10 |
| Diety (wege/keto/bezglutenowe) | 2, 7, 8 |
| Alergeny (gluten/mięso/nabiał/orzechy/ryby) | 2, 7, 8 |
| Kcal + makro | 2, 6, 8, 10 |
| Dowolna liczba posiłków dziennie | 9, 10 |
| Offline lista zakupów | 12 |
| Spiżarnia (mam/nie mam) | 12 |
| Udostępnianie znajomym | 13 |
| Udostępnianie w gospodarstwie | 4, 13 |
| Backup | 18 |
| Zero kosztów | 1, 3, 4, 17, 18 (Vercel + Supabase + Gemini free) |

### 2. Placeholder scan

Brak `TBD`, `TODO`, `implement later`. Każdy step ma kod lub komendę. Wyjątek: w Task 3 seed pokazuje 20 z 40 składników z komentarzem `-- ... 20 kolejnych: ...` — to celowe, bo lista jest długa i oczywista. Wykonawca ma uzupełnić z OFF.

### 3. Type consistency

- `RecipeJsonLd` (Task 2) używany w 15, 16 — zgodne.
- `Macros` (Task 2) używany w 6, 8, 10 — zgodne.
- `ShoppingItem` (Task 2) używany w 11, 12 — zgodne.
- `PlanWithSlots` (Task 9) używany w 10, 12 — zgodne.
- `PickedIngredient` (Task 7) używany w 16 — zgodne.
- `LlmFn` (Task 15) używany w 15, 17 — zgodne.
- `SYSTEM_PROMPT` (Task 15) re-eksportowany w 17 — zgodne.

### 4. Review Focus

| Przypadek | Test |
|---|---|
| Przepis z zerem porcji | Task 6 `perServing` (0 i -1) |
| Składnik bez makro | Task 6 `calculateIngredientMacros` (null); Task 11 `incomplete: true` |
| Ten sam składnik, różne jednostki | Task 11 `does NOT sum same ingredient in different units` |
| Slot → usunięty przepis | Task 9 SQL test FK `ON DELETE SET NULL` |
| Import bez treści przepisu | Task 15 `throws after max retries on garbage` + `rejects JSON without name` |

---

**Plan kompletny i zapisany do `docs/superpowers/plans/2026-09-20-meal-planner-mvp.md`. Proszę o review planu. Którą metodę wykonania wybierasz?**

- **Subagent-driven** — świeży subagent implementuje każde zadanie, świeży reviewer sprawdza je przed następnym, na końcu review całej gałęzi. Najdokładniejsze; kosztuje świeży kontekst na zadanie i review.
- **Native** — implementuję każde zadanie sam w tej sesji, potem jeden świeży reviewer na najzdolniejszym modelu sprawdza całą gałąź. Najtańsze i najszybsze; brak niezależnego review do końca. Działa dobrze z mid-tier modelem sesji, bo plan niesie design.

**Dla tego planu rekomenduję Subagent-driven**, ponieważ zadania mają silne zależności interfejsowe (typy z Task 2 używane w 7, 11, 15; `SYSTEM_PROMPT` w 15 i 17) i błąd w sygnaturze rozleje się szeroko — świeży reviewer per zadanie wyłapie to wcześnie. Czy plan oddaje to, czego chcesz, i którą metodę wykonania wybieramy?