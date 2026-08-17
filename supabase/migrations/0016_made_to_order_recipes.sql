-- Some recipes (e.g. a grilled-pork platter) are cooked fresh per order,
-- not batch-produced and held as finished-goods stock like the bottled
-- sauces. is_made_to_order marks those recipes; for them, logging a sale
-- deducts raw ingredients directly (qty_used * qty_bottles, same shape as
-- deduct_stock_on_batch's shortfall-check-then-deduct) instead of touching
-- finished_goods_stock, which is never created for these recipes.
--
-- sale_ingredient_usage is the snapshot table for that deduction, mirroring
-- batch_ingredient_usage exactly, so voiding a made-to-order sale restores
-- the correct historical amount rather than recomputing from (possibly
-- since-edited) recipe_ingredients.

alter table recipes add column if not exists is_made_to_order boolean not null default false;

create table if not exists sale_ingredient_usage (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  qty_used numeric not null
);

create index if not exists sale_ingredient_usage_sale_id_idx on sale_ingredient_usage(sale_id);

alter table sale_ingredient_usage enable row level security;

create policy "sale_ingredient_usage_select_own" on sale_ingredient_usage
  for select using (
    exists (select 1 from sales s where s.id = sale_id and s.user_id = auth.uid())
  );
create policy "sale_ingredient_usage_insert_own" on sale_ingredient_usage
  for insert with check (
    exists (select 1 from sales s where s.id = sale_id and s.user_id = auth.uid())
  );
create policy "sale_ingredient_usage_delete_own" on sale_ingredient_usage
  for delete using (
    exists (select 1 from sales s where s.id = sale_id and s.user_id = auth.uid())
  );

create or replace function deduct_finished_goods_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipe_name text;
  is_mto boolean;
  available numeric;
  shortfalls text;
begin
  select r.name, r.is_made_to_order into recipe_name, is_mto
  from recipes r
  where r.id = new.recipe_id and r.user_id = new.user_id;

  if recipe_name is null then
    raise exception 'Recipe not found' using errcode = 'P0001';
  end if;

  if is_mto then
    select string_agg(
      format('%s (need %s %s, have %s %s)',
        i.name, ri.qty_used * new.qty_bottles, i.unit, i.qty_on_hand, i.unit),
      ', '
    )
    into shortfalls
    from recipe_ingredients ri
    join ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = new.recipe_id
      and i.qty_on_hand < ri.qty_used * new.qty_bottles;

    if shortfalls is not null then
      raise exception 'Not enough stock to log this sale: %', shortfalls
        using errcode = 'P0001';
    end if;

    update ingredients i
    set qty_on_hand = i.qty_on_hand - ri.qty_used * new.qty_bottles
    from recipe_ingredients ri
    where ri.recipe_id = new.recipe_id
      and ri.ingredient_id = i.id;
  else
    select fg.qty_on_hand
    into available
    from finished_goods_stock fg
    where fg.recipe_id = new.recipe_id;

    if available is null or available < new.qty_bottles then
      raise exception 'Not enough bottles in stock for %: need %, have %',
        recipe_name, new.qty_bottles, coalesce(available, 0)
        using errcode = 'P0001';
    end if;

    update finished_goods_stock
    set qty_on_hand = qty_on_hand - new.qty_bottles
    where recipe_id = new.recipe_id;
  end if;

  return new;
end;
$$;
