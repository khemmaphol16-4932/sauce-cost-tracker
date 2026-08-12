-- General business expenses that aren't ingredient purchases: rent,
-- utilities, labor, one-off costs. Ingredient buying already has its own
-- table (`purchases`); this is everything else, so Financials can show the
-- full picture of money going out.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  category text not null default 'other',
  description text,
  amount numeric not null check (amount >= 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists expenses_business_id_idx on expenses(business_id);
create index if not exists expenses_user_id_idx on expenses(user_id);

alter table expenses enable row level security;

create policy "expenses_select_own" on expenses
  for select using (user_id = auth.uid());
create policy "expenses_insert_own" on expenses
  for insert with check (user_id = auth.uid());
create policy "expenses_update_own" on expenses
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses_delete_own" on expenses
  for delete using (user_id = auth.uid());
