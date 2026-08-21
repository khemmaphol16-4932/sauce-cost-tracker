-- Physical stock counts had no home in the app. The only control that moved
-- ingredients.qty_on_hand was "+ Purchase", which requires a price — so count
-- corrections got logged as purchases at a placeholder ฿1, and
-- recalc_ingredient_on_purchase (0001) folded them permanently into
-- avg_price_per_unit. Measured effect in production: ingredient costs
-- understated by up to 87%, so every reported margin looked better than it was.
--
-- This adds a first-class adjustment ledger plus atomic "counted quantity"
-- RPCs for both stock kinds. Table shape mirrors waste_log (0009): one log, a
-- `kind` discriminator, and a check constraint pinning exactly one target
-- column. The RPCs mirror adjust_finished_goods_stock (0013): security definer
-- with an explicit auth.uid() ownership check raising P0001.
--
-- The ledger also closes an existing gap: adjustFinishedGoods has always asked
-- the operator for a reason and then discarded it, so there was no audit trail
-- for stock adjustments of either kind.

create table if not exists stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('ingredient', 'finished_goods')),
  ingredient_id uuid references ingredients(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete cascade,
  delta numeric not null,
  resulting_qty numeric,
  reason text not null default 'other',
  notes text,
  adjustment_date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint stock_adjustments_target_matches_kind check (
    (kind = 'ingredient' and ingredient_id is not null and recipe_id is null) or
    (kind = 'finished_goods' and recipe_id is not null and ingredient_id is null)
  ),
  constraint stock_adjustments_delta_nonzero check (delta <> 0)
);

create index if not exists stock_adjustments_business_id_idx on stock_adjustments(business_id);
create index if not exists stock_adjustments_ingredient_id_idx on stock_adjustments(ingredient_id);
create index if not exists stock_adjustments_recipe_id_idx on stock_adjustments(recipe_id);

alter table stock_adjustments enable row level security;

-- `create policy` has no `if not exists`, so drop first to keep this file
-- re-runnable (same habit as `drop trigger if exists` elsewhere in the repo).
drop policy if exists "stock_adjustments_select_own" on stock_adjustments;
drop policy if exists "stock_adjustments_insert_own" on stock_adjustments;
drop policy if exists "stock_adjustments_update_own" on stock_adjustments;
drop policy if exists "stock_adjustments_delete_own" on stock_adjustments;

create policy "stock_adjustments_select_own" on stock_adjustments
  for select using (user_id = auth.uid());
create policy "stock_adjustments_insert_own" on stock_adjustments
  for insert with check (user_id = auth.uid());
create policy "stock_adjustments_update_own" on stock_adjustments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "stock_adjustments_delete_own" on stock_adjustments
  for delete using (user_id = auth.uid());

-- Records a physical stock count for a raw ingredient.
--
-- Takes the COUNTED quantity, not a delta: the operator counts the shelf and
-- types what is there. The delta is derived from the live row inside this
-- function, so the ledger entry can never disagree with the stock change, and
-- there is no read-then-write race. Assigning (rather than incrementing) also
-- means stock can't be driven negative — a bad input is rejected loudly
-- instead of being silently clamped.
create or replace function adjust_ingredient_stock(
  p_ingredient_id uuid,
  p_counted_qty numeric,
  p_reason text,
  p_notes text default null,
  p_adjustment_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_current numeric;
  v_delta numeric;
begin
  select i.business_id, i.qty_on_hand
  into v_business_id, v_current
  from ingredients i
  where i.id = p_ingredient_id and i.user_id = auth.uid();

  if v_business_id is null then
    raise exception 'Ingredient not found' using errcode = 'P0001';
  end if;

  if p_counted_qty is null or p_counted_qty < 0 then
    raise exception 'Counted quantity cannot be negative' using errcode = 'P0001';
  end if;

  v_delta := p_counted_qty - v_current;

  if v_delta = 0 then
    raise exception 'Counted quantity is already the recorded quantity — nothing to adjust'
      using errcode = 'P0001';
  end if;

  insert into stock_adjustments
    (user_id, business_id, kind, ingredient_id, delta, resulting_qty, reason, notes, adjustment_date)
  values
    (auth.uid(), v_business_id, 'ingredient', p_ingredient_id, v_delta, p_counted_qty,
     coalesce(nullif(trim(p_reason), ''), 'other'), nullif(trim(p_notes), ''), p_adjustment_date);

  update ingredients
  set qty_on_hand = p_counted_qty
  where id = p_ingredient_id and user_id = auth.uid();
end;
$$;

-- Finished-goods equivalent, for the manual count path only.
--
-- Deliberately a NEW function rather than a change to adjust_finished_goods_stock:
-- that one has four callers (deleteBatch, updateBatch, deleteSale, and the old
-- adjust path) which pass a delta and have no reason to record — reversing a
-- batch is not a count correction, and writing ledger rows for those would be
-- noise. Adding a defaulted parameter there would also make PostgREST overload
-- resolution depend on which JSON keys the caller happens to send.
create or replace function adjust_finished_goods_counted(
  p_recipe_id uuid,
  p_counted_qty numeric,
  p_reason text,
  p_notes text default null,
  p_adjustment_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_current numeric;
  v_delta numeric;
begin
  select r.business_id
  into v_business_id
  from recipes r
  where r.id = p_recipe_id and r.user_id = auth.uid();

  if v_business_id is null then
    raise exception 'Recipe not found' using errcode = 'P0001';
  end if;

  if p_counted_qty is null or p_counted_qty < 0 then
    raise exception 'Counted quantity cannot be negative' using errcode = 'P0001';
  end if;

  -- No stock row yet means zero on hand, not an error — a recipe can be
  -- counted before its first batch is ever logged.
  select fg.qty_on_hand
  into v_current
  from finished_goods_stock fg
  where fg.recipe_id = p_recipe_id;
  v_current := coalesce(v_current, 0);

  v_delta := p_counted_qty - v_current;

  if v_delta = 0 then
    raise exception 'Counted quantity is already the recorded quantity — nothing to adjust'
      using errcode = 'P0001';
  end if;

  insert into stock_adjustments
    (user_id, business_id, kind, recipe_id, delta, resulting_qty, reason, notes, adjustment_date)
  values
    (auth.uid(), v_business_id, 'finished_goods', p_recipe_id, v_delta, p_counted_qty,
     coalesce(nullif(trim(p_reason), ''), 'other'), nullif(trim(p_notes), ''), p_adjustment_date);

  insert into finished_goods_stock (user_id, recipe_id, qty_on_hand)
  values (auth.uid(), p_recipe_id, p_counted_qty)
  on conflict (recipe_id) do update
    set qty_on_hand = p_counted_qty;
end;
$$;
