-- Finished-goods bottle inventory: batches currently only deduct raw
-- ingredients, they never credit a "N bottles of Recipe X ready to sell"
-- count anywhere. This introduces that as its own table (not derived),
-- so it can later be corrected for breakage/spoilage independent of both
-- batches and sales, and so it has a queryable history.

create table if not exists finished_goods_stock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  qty_on_hand numeric not null default 0,
  low_stock_threshold numeric,
  created_at timestamptz not null default now()
);

create unique index if not exists finished_goods_stock_recipe_id_key on finished_goods_stock(recipe_id);

alter table finished_goods_stock enable row level security;

-- Scoped via the parent recipe's user_id (no user_id-only check would be
-- enough on its own, but this matches the recipe_ingredients/sop_steps
-- transitive-ownership pattern used throughout this schema).
create policy "finished_goods_stock_select_own" on finished_goods_stock
  for select using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "finished_goods_stock_insert_own" on finished_goods_stock
  for insert with check (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "finished_goods_stock_update_own" on finished_goods_stock
  for update using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "finished_goods_stock_delete_own" on finished_goods_stock
  for delete using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );

-- Credits finished_goods_stock by actual_yield_bottles whenever a batch is
-- logged — the same number the batch-logging UI already collects (either
-- the calc-engine estimate or a manual override), not the theoretical
-- bottlesPerBatch estimate. Fires alongside (not instead of) the existing
-- BEFORE INSERT raw-ingredient-deduction trigger on the same table.
create or replace function credit_finished_goods_on_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into finished_goods_stock (user_id, recipe_id, qty_on_hand)
  values (new.user_id, new.recipe_id, coalesce(new.actual_yield_bottles, 0))
  on conflict (recipe_id) do update
    set qty_on_hand = finished_goods_stock.qty_on_hand + coalesce(new.actual_yield_bottles, 0);

  return new;
end;
$$;

drop trigger if exists trg_batch_credit_finished_goods on batches;
create trigger trg_batch_credit_finished_goods
  after insert on batches
  for each row execute function credit_finished_goods_on_batch();
