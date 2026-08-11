-- Real sales tracking. Everything before this migration only estimated
-- theoretical margin (target_sell_price on recipes); this is the first
-- table recording money actually coming in.

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete restrict,
  qty_bottles numeric not null check (qty_bottles > 0),
  price_charged_total numeric not null check (price_charged_total >= 0),
  platform text not null default 'self',
  platform_fee_pct numeric,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'pending', 'refunded')),
  payment_method text,
  sale_date date not null default current_date,
  cost_per_bottle_snapshot numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists sales_recipe_id_idx on sales(recipe_id);
create index if not exists sales_business_id_idx on sales(business_id);
create index if not exists sales_user_id_idx on sales(user_id);

alter table sales enable row level security;

create policy "sales_select_own" on sales
  for select using (user_id = auth.uid());
create policy "sales_insert_own" on sales
  for insert with check (user_id = auth.uid());
create policy "sales_update_own" on sales
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sales_delete_own" on sales
  for delete using (user_id = auth.uid());

-- Deducts finished_goods_stock.qty_on_hand when a sale is logged. Mirrors
-- deduct_stock_on_batch exactly: blocks the insert (raises P0001) if there
-- isn't enough finished-goods stock, naming the shortfall.
create or replace function deduct_finished_goods_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available numeric;
  recipe_name text;
begin
  select fg.qty_on_hand, r.name
  into available, recipe_name
  from finished_goods_stock fg
  join recipes r on r.id = fg.recipe_id
  where fg.recipe_id = new.recipe_id;

  if available is null or available < new.qty_bottles then
    raise exception 'Not enough bottles in stock for %: need %, have %',
      coalesce(recipe_name, 'this recipe'), new.qty_bottles, coalesce(available, 0)
      using errcode = 'P0001';
  end if;

  update finished_goods_stock
  set qty_on_hand = qty_on_hand - new.qty_bottles
  where recipe_id = new.recipe_id;

  return new;
end;
$$;

drop trigger if exists trg_sale_deduct_finished_goods on sales;
create trigger trg_sale_deduct_finished_goods
  before insert on sales
  for each row execute function deduct_finished_goods_on_sale();
