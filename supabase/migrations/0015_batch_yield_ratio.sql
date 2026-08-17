-- Ingredient deduction for a batch was always the full recipe amount,
-- regardless of actual_yield_bottles — logging a half batch (or a batch
-- that came up short) still drained ingredients for the full recipe.
-- yield_ratio (actual_yield_bottles / the recipe's estimated bottles for
-- that batch, computed once in logBatch via calcRecipeCost — not
-- re-derived here in SQL, to avoid duplicating that formula in two
-- places) scales the deduction to what was actually used. Defaults to 1
-- so existing batches keep today's behavior.

alter table batches add column if not exists yield_ratio numeric not null default 1;

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
      i.name, ri.qty_used * new.yield_ratio, i.unit, i.qty_on_hand, i.unit),
    ', '
  )
  into shortfalls
  from recipe_ingredients ri
  join ingredients i on i.id = ri.ingredient_id
  where ri.recipe_id = new.recipe_id
    and i.qty_on_hand < ri.qty_used * new.yield_ratio;

  if shortfalls is not null then
    raise exception 'Not enough stock to log this batch: %', shortfalls
      using errcode = 'P0001';
  end if;

  update ingredients i
  set qty_on_hand = i.qty_on_hand - ri.qty_used * new.yield_ratio
  from recipe_ingredients ri
  where ri.recipe_id = new.recipe_id
    and ri.ingredient_id = i.id;

  return new;
end;
$$;
