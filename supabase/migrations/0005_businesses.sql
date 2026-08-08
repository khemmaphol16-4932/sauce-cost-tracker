-- Adds a "business" concept so one account can track multiple separate food
-- businesses (e.g. a sauce line and a noodle line) without their ingredients
-- and recipes mixing together.

-- ─────────────────────────────────────────────────────────────
-- businesses
-- ─────────────────────────────────────────────────────────────
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;

create policy "businesses_select_own" on businesses
  for select using (user_id = auth.uid());
create policy "businesses_insert_own" on businesses
  for insert with check (user_id = auth.uid());
create policy "businesses_update_own" on businesses
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "businesses_delete_own" on businesses
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Backfill: give every user with existing ingredients/recipes a "Sauce"
-- business, and point their existing rows at it, before the column is
-- required.
-- ─────────────────────────────────────────────────────────────
insert into businesses (user_id, name)
select distinct user_id, 'Sauce'
from (
  select user_id from ingredients
  union
  select user_id from recipes
) existing_users
where not exists (
  select 1 from businesses b where b.user_id = existing_users.user_id
);

alter table ingredients add column if not exists business_id uuid references businesses(id) on delete cascade;
alter table recipes add column if not exists business_id uuid references businesses(id) on delete cascade;

update ingredients i
set business_id = b.id
from businesses b
where i.business_id is null and b.user_id = i.user_id and b.name = 'Sauce';

update recipes r
set business_id = b.id
from businesses b
where r.business_id is null and b.user_id = r.user_id and b.name = 'Sauce';

alter table ingredients alter column business_id set not null;
alter table recipes alter column business_id set not null;

create index if not exists ingredients_business_id_idx on ingredients(business_id);
create index if not exists recipes_business_id_idx on recipes(business_id);
