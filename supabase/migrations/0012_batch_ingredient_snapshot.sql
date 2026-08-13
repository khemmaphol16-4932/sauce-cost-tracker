-- Snapshots exactly which ingredients (and how much of each) a batch
-- consumed at the moment it was logged. Without this, deleting a batch
-- has to guess by reading *today's* recipe_ingredients — which silently
-- restores the wrong amounts if the recipe's ingredients were edited
-- after the batch was logged. Mirrors the precedent already set by
-- batches.cost_per_bottle_snapshot (snapshot a value at insert time
-- instead of trusting it stays stable), just applied to quantities too.

create table if not exists batch_ingredient_usage (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  qty_used numeric not null
);

create index if not exists batch_ingredient_usage_batch_id_idx on batch_ingredient_usage(batch_id);

alter table batch_ingredient_usage enable row level security;

-- Scoped via the parent batch's user_id (no user_id column on this table),
-- same transitive-ownership pattern as recipe_ingredients/sop_steps.
create policy "batch_ingredient_usage_select_own" on batch_ingredient_usage
  for select using (
    exists (select 1 from batches b where b.id = batch_id and b.user_id = auth.uid())
  );
create policy "batch_ingredient_usage_insert_own" on batch_ingredient_usage
  for insert with check (
    exists (select 1 from batches b where b.id = batch_id and b.user_id = auth.uid())
  );
create policy "batch_ingredient_usage_delete_own" on batch_ingredient_usage
  for delete using (
    exists (select 1 from batches b where b.id = batch_id and b.user_id = auth.uid())
  );
