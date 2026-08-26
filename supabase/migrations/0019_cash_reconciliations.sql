-- Daily cash closing. The operator counts the drawer at end of day and
-- compares it to what the app expects (sum of paid cash sales for that day);
-- this table records both numbers and the variance so a shortfall/overage
-- isn't just a memory. Table shape follows stock_adjustments (0017): a plain
-- record-what-happened-and-why table, server-computed authoritative values
-- rather than trusting client input, RLS via user_id = auth.uid().
--
-- Unlike stock_adjustments this isn't mutating another table's balance, so a
-- plain server action is enough — no security-definer RPC needed.
--
-- One row per business per day (unique constraint below); re-closing the same
-- day after a counting mistake is expected, not an edge case, so the app
-- upserts on that constraint rather than growing duplicate rows.

create table if not exists cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  reconciliation_date date not null default current_date,
  expected_cash numeric not null,
  counted_cash numeric not null,
  variance numeric generated always as (counted_cash - expected_cash) stored,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_reconciliations_business_date_unique unique (business_id, reconciliation_date)
);

create index if not exists cash_reconciliations_business_id_idx on cash_reconciliations(business_id);

alter table cash_reconciliations enable row level security;

drop policy if exists "cash_reconciliations_select_own" on cash_reconciliations;
drop policy if exists "cash_reconciliations_insert_own" on cash_reconciliations;
drop policy if exists "cash_reconciliations_update_own" on cash_reconciliations;
drop policy if exists "cash_reconciliations_delete_own" on cash_reconciliations;

create policy "cash_reconciliations_select_own" on cash_reconciliations
  for select using (user_id = auth.uid());
create policy "cash_reconciliations_insert_own" on cash_reconciliations
  for insert with check (user_id = auth.uid());
create policy "cash_reconciliations_update_own" on cash_reconciliations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cash_reconciliations_delete_own" on cash_reconciliations
  for delete using (user_id = auth.uid());
