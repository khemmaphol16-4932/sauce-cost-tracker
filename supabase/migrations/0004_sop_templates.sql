-- Reusable SOP step templates (user-scoped, not tied to a single recipe),
-- so common steps like "sanitize bottles" can be inserted into any recipe
-- instead of retyped each time.

create table if not exists sop_step_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  instruction text not null,
  created_at timestamptz not null default now()
);

alter table sop_step_templates enable row level security;

create policy "sop_step_templates_select_own" on sop_step_templates
  for select using (user_id = auth.uid());
create policy "sop_step_templates_insert_own" on sop_step_templates
  for insert with check (user_id = auth.uid());
create policy "sop_step_templates_delete_own" on sop_step_templates
  for delete using (user_id = auth.uid());
