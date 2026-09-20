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
