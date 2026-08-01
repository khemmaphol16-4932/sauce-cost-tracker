-- Sauce Cost & Stock Tracker — initial schema
-- Run this once in Supabase Dashboard → SQL Editor (or `supabase db push`).
-- Every table is scoped by user_id with RLS so each user only ever sees their own rows.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ingredients
-- ─────────────────────────────────────────────────────────────
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  unit text not null,
  qty_on_hand numeric not null default 0,
  avg_price_per_unit numeric not null default 0,
  low_stock_threshold numeric,
  created_at timestamptz not null default now()
);

alter table ingredients enable row level security;

create policy "ingredients_select_own" on ingredients
  for select using (user_id = auth.uid());
create policy "ingredients_insert_own" on ingredients
  for insert with check (user_id = auth.uid());
create policy "ingredients_update_own" on ingredients
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ingredients_delete_own" on ingredients
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- purchases
-- ─────────────────────────────────────────────────────────────
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  qty_bought numeric not null check (qty_bought > 0),
  price_paid_total numeric not null check (price_paid_total >= 0),
  purchase_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists purchases_ingredient_id_idx on purchases(ingredient_id);
create index if not exists purchases_user_id_idx on purchases(user_id);

alter table purchases enable row level security;

create policy "purchases_select_own" on purchases
  for select using (user_id = auth.uid());
create policy "purchases_insert_own" on purchases
  for insert with check (user_id = auth.uid());
create policy "purchases_update_own" on purchases
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "purchases_delete_own" on purchases
  for delete using (user_id = auth.uid());

-- Recalculate qty_on_hand + avg_price_per_unit (weighted avg across ALL purchases
-- for that ingredient: total ฿ spent / total qty bought) whenever a purchase is logged.
create or replace function recalc_ingredient_on_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update ingredients
  set qty_on_hand = qty_on_hand + new.qty_bought,
      avg_price_per_unit = (
        select sum(price_paid_total) / nullif(sum(qty_bought), 0)
        from purchases
        where ingredient_id = new.ingredient_id
      )
  where id = new.ingredient_id
    and user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_purchase_recalc on purchases;
create trigger trg_purchase_recalc
  after insert on purchases
  for each row execute function recalc_ingredient_on_purchase();

-- ─────────────────────────────────────────────────────────────
-- recipes
-- ─────────────────────────────────────────────────────────────
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  bottle_size_ml numeric not null,
  target_sell_price numeric,
  platform_fee_pct numeric not null default 0,
  labor_hours_per_batch numeric not null default 0,
  labor_rate_per_hour numeric not null default 0,
  overhead_per_batch numeric not null default 0,
  waste_pct numeric not null default 0,
  evaporation_loss_pct numeric not null default 0,
  batch_volume_ml numeric not null,
  created_at timestamptz not null default now()
);

alter table recipes enable row level security;

create policy "recipes_select_own" on recipes
  for select using (user_id = auth.uid());
create policy "recipes_insert_own" on recipes
  for insert with check (user_id = auth.uid());
create policy "recipes_update_own" on recipes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recipes_delete_own" on recipes
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- recipe_ingredients (join table: ingredient quantities for one recipe)
-- ─────────────────────────────────────────────────────────────
create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  qty_used numeric not null check (qty_used > 0)
);

create index if not exists recipe_ingredients_recipe_id_idx on recipe_ingredients(recipe_id);

alter table recipe_ingredients enable row level security;

-- Scoped via the parent recipe's user_id (no user_id column on this table).
create policy "recipe_ingredients_select_own" on recipe_ingredients
  for select using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "recipe_ingredients_insert_own" on recipe_ingredients
  for insert with check (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "recipe_ingredients_update_own" on recipe_ingredients
  for update using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "recipe_ingredients_delete_own" on recipe_ingredients
  for delete using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- packaging_costs (per recipe)
-- ─────────────────────────────────────────────────────────────
create table if not exists packaging_costs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  item_name text not null,
  cost_per_unit numeric not null check (cost_per_unit >= 0)
);

create index if not exists packaging_costs_recipe_id_idx on packaging_costs(recipe_id);

alter table packaging_costs enable row level security;

create policy "packaging_costs_select_own" on packaging_costs
  for select using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "packaging_costs_insert_own" on packaging_costs
  for insert with check (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "packaging_costs_update_own" on packaging_costs
  for update using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "packaging_costs_delete_own" on packaging_costs
  for delete using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- batches (logs a cooked batch — triggers stock deduction)
-- ─────────────────────────────────────────────────────────────
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete restrict,
  batch_date date not null default current_date,
  actual_yield_bottles numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists batches_recipe_id_idx on batches(recipe_id);
create index if not exists batches_user_id_idx on batches(user_id);

alter table batches enable row level security;

create policy "batches_select_own" on batches
  for select using (user_id = auth.uid());
create policy "batches_insert_own" on batches
  for insert with check (user_id = auth.uid());
create policy "batches_update_own" on batches
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "batches_delete_own" on batches
  for delete using (user_id = auth.uid());

-- Deducts each recipe_ingredients.qty_used from ingredients.qty_on_hand when a batch
-- is logged. BLOCKS the insert (raises an exception) if any ingredient doesn't have
-- enough stock, listing every short ingredient and by how much.
create or replace function deduct_stock_on_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shortfalls text;
begin
  select string_agg(
    format('%s (need %s %s, have %s %s)',
      i.name, ri.qty_used, i.unit, i.qty_on_hand, i.unit),
    ', '
  )
  into shortfalls
  from recipe_ingredients ri
  join ingredients i on i.id = ri.ingredient_id
  where ri.recipe_id = new.recipe_id
    and i.qty_on_hand < ri.qty_used;

  if shortfalls is not null then
    raise exception 'Not enough stock to log this batch: %', shortfalls
      using errcode = 'P0001';
  end if;

  update ingredients i
  set qty_on_hand = i.qty_on_hand - ri.qty_used
  from recipe_ingredients ri
  where ri.recipe_id = new.recipe_id
    and ri.ingredient_id = i.id;

  return new;
end;
$$;

drop trigger if exists trg_batch_deduct on batches;
create trigger trg_batch_deduct
  before insert on batches
  for each row execute function deduct_stock_on_batch();
