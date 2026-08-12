-- Waste tracking: raw ingredients that spoiled/were discarded before
-- cooking, and finished bottles that had to be thrown out after. One log,
-- discriminated by `kind`, so both flow into the same waste analytics.

create table if not exists waste_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('ingredient', 'finished_goods')),
  ingredient_id uuid references ingredients(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete cascade,
  qty numeric not null check (qty > 0),
  reason text not null default 'other',
  waste_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  constraint waste_log_target_matches_kind check (
    (kind = 'ingredient' and ingredient_id is not null and recipe_id is null) or
    (kind = 'finished_goods' and recipe_id is not null and ingredient_id is null)
  )
);

create index if not exists waste_log_business_id_idx on waste_log(business_id);
create index if not exists waste_log_ingredient_id_idx on waste_log(ingredient_id);
create index if not exists waste_log_recipe_id_idx on waste_log(recipe_id);

alter table waste_log enable row level security;

create policy "waste_log_select_own" on waste_log
  for select using (user_id = auth.uid());
create policy "waste_log_insert_own" on waste_log
  for insert with check (user_id = auth.uid());
create policy "waste_log_update_own" on waste_log
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "waste_log_delete_own" on waste_log
  for delete using (user_id = auth.uid());

-- Deducts the wasted qty from the relevant stock table. Blocks the insert
-- (raises P0001) if there isn't enough on hand — mirrors
-- deduct_stock_on_batch / deduct_finished_goods_on_sale.
create or replace function deduct_stock_on_waste()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available numeric;
  item_name text;
begin
  if new.kind = 'ingredient' then
    select qty_on_hand, name into available, item_name
    from ingredients where id = new.ingredient_id;

    if available is null or available < new.qty then
      raise exception 'Not enough % in stock to log this waste: need %, have %',
        coalesce(item_name, 'this ingredient'), new.qty, coalesce(available, 0)
        using errcode = 'P0001';
    end if;

    update ingredients set qty_on_hand = qty_on_hand - new.qty where id = new.ingredient_id;
  else
    select fg.qty_on_hand, r.name into available, item_name
    from finished_goods_stock fg
    join recipes r on r.id = fg.recipe_id
    where fg.recipe_id = new.recipe_id;

    if available is null or available < new.qty then
      raise exception 'Not enough bottles of % in stock to log this waste: need %, have %',
        coalesce(item_name, 'this recipe'), new.qty, coalesce(available, 0)
        using errcode = 'P0001';
    end if;

    update finished_goods_stock set qty_on_hand = qty_on_hand - new.qty where recipe_id = new.recipe_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_waste_deduct_stock on waste_log;
create trigger trg_waste_deduct_stock
  before insert on waste_log
  for each row execute function deduct_stock_on_waste();
