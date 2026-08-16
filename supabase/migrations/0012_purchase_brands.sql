-- Lets a purchase be tagged with a brand (e.g. "pork" bought as CP one day,
-- Aro the next) without affecting costing: `avg_price_per_unit` and
-- `qty_on_hand` are still recalculated purely from qty_bought/price_paid_total
-- (see recalc_ingredient_on_purchase in 0001_init.sql), so different-brand
-- purchases of the same ingredient keep rolling up together automatically.
--
-- ingredient_brands is the picklist source only, scoped per ingredient so
-- brand names stay consistent when logging a purchase. purchases.brand is a
-- plain text snapshot (not a hard FK) so renaming/removing a brand later
-- never mutates historical purchase records — same snapshot-at-insert-time
-- precedent as cost_per_bottle_snapshot elsewhere in this schema.

create table if not exists ingredient_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists ingredient_brands_ingredient_id_idx on ingredient_brands(ingredient_id);
create unique index if not exists ingredient_brands_ingredient_name_ci_idx
  on ingredient_brands (ingredient_id, lower(name));

alter table ingredient_brands enable row level security;

create policy "ingredient_brands_select_own" on ingredient_brands
  for select using (user_id = auth.uid());
create policy "ingredient_brands_insert_own" on ingredient_brands
  for insert with check (user_id = auth.uid());
create policy "ingredient_brands_update_own" on ingredient_brands
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ingredient_brands_delete_own" on ingredient_brands
  for delete using (user_id = auth.uid());

alter table purchases add column if not exists brand text;
