-- Adds VAT/tax handling to recipes and a per-recipe production SOP checklist.

alter table recipes add column if not exists vat_pct numeric not null default 0;

-- ─────────────────────────────────────────────────────────────
-- sop_steps (ordered production checklist per recipe)
-- ─────────────────────────────────────────────────────────────
create table if not exists sop_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  step_order integer not null default 1,
  instruction text not null,
  created_at timestamptz not null default now()
);

create index if not exists sop_steps_recipe_id_idx on sop_steps(recipe_id);

alter table sop_steps enable row level security;

-- Scoped via the parent recipe's user_id (no user_id column on this table),
-- same pattern as recipe_ingredients / packaging_costs.
create policy "sop_steps_select_own" on sop_steps
  for select using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "sop_steps_insert_own" on sop_steps
  for insert with check (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "sop_steps_update_own" on sop_steps
  for update using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
create policy "sop_steps_delete_own" on sop_steps
  for delete using (
    exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
