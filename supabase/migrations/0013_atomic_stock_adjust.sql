-- 1) A single atomic RPC for adjusting finished_goods_stock, replacing the
-- read-qty-then-write-qty pattern used in several server actions (deleteBatch,
-- updateBatch, deleteSale, adjustFinishedGoods). That pattern has a lost-update
-- race: two concurrent adjustments (e.g. a sale and a batch delete happening
-- around the same time) can clobber each other because the write uses a value
-- read earlier, not a live increment. This does the increment inside the
-- database in one statement instead. Upserts (so callers like
-- adjustFinishedGoods that may run before any batch has ever been logged for
-- a recipe still work), clamps at 0 (stock can't go negative from a manual
-- adjustment), and checks the recipe belongs to the caller before touching
-- anything — auth.uid() inside a security definer function still reflects
-- the calling user's session, not the definer's, so this is a real check.
create or replace function adjust_finished_goods_stock(p_recipe_id uuid, p_delta numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from recipes r where r.id = p_recipe_id and r.user_id = auth.uid()) then
    raise exception 'Recipe not found' using errcode = 'P0001';
  end if;

  insert into finished_goods_stock (user_id, recipe_id, qty_on_hand)
  values (auth.uid(), p_recipe_id, greatest(0, p_delta))
  on conflict (recipe_id) do update
    set qty_on_hand = greatest(0, finished_goods_stock.qty_on_hand + p_delta);
end;
$$;

-- 2) Ownership checks on the security definer trigger functions. Each of
-- these runs with elevated privilege and, until now, trusted the client-
-- supplied recipe_id/ingredient_id without verifying it actually belongs to
-- the same user as the row being inserted — RLS on the *inserted* table
-- checks user_id, but these functions then read/write OTHER tables
-- (ingredients, finished_goods_stock) by that id with no matching check.
-- Adds an explicit ownership check to each, raising the same P0001 pattern
-- already used for stock-shortfall errors.

create or replace function deduct_stock_on_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shortfalls text;
begin
  if not exists (select 1 from recipes r where r.id = new.recipe_id and r.user_id = new.user_id) then
    raise exception 'Recipe not found' using errcode = 'P0001';
  end if;

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

create or replace function credit_finished_goods_on_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from recipes r where r.id = new.recipe_id and r.user_id = new.user_id) then
    raise exception 'Recipe not found' using errcode = 'P0001';
  end if;

  insert into finished_goods_stock (user_id, recipe_id, qty_on_hand)
  values (new.user_id, new.recipe_id, coalesce(new.actual_yield_bottles, 0))
  on conflict (recipe_id) do update
    set qty_on_hand = finished_goods_stock.qty_on_hand + coalesce(new.actual_yield_bottles, 0);

  return new;
end;
$$;

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
  if not exists (select 1 from recipes r where r.id = new.recipe_id and r.user_id = new.user_id) then
    raise exception 'Recipe not found' using errcode = 'P0001';
  end if;

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
    if not exists (
      select 1 from ingredients i where i.id = new.ingredient_id and i.user_id = new.user_id
    ) then
      raise exception 'Ingredient not found' using errcode = 'P0001';
    end if;

    select qty_on_hand, name into available, item_name
    from ingredients where id = new.ingredient_id;

    if available is null or available < new.qty then
      raise exception 'Not enough % in stock to log this waste: need %, have %',
        coalesce(item_name, 'this ingredient'), new.qty, coalesce(available, 0)
        using errcode = 'P0001';
    end if;

    update ingredients set qty_on_hand = qty_on_hand - new.qty where id = new.ingredient_id;
  else
    if not exists (
      select 1 from recipes r where r.id = new.recipe_id and r.user_id = new.user_id
    ) then
      raise exception 'Recipe not found' using errcode = 'P0001';
    end if;

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
