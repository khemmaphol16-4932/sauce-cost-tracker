-- Print queue for the shop computer ("print station"). The phone that takes
-- the order can't reach the PeriPage over Bluetooth from a browser (iOS has no
-- Web Bluetooth, and the A6 speaks Bluetooth Classic anyway), so checkout
-- drops a job here and the /print-station page — open in Chrome on the shop
-- computer, connected to the paired printer via Web Serial — prints it.
--
-- Requires 0020 (businesses.print_after_sale). Same RLS shape as the rest of
-- the schema: user_id = auth.uid(), business_id for scoping.

create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  -- Receipt content only (lines, total, customer, date). The station adds the
  -- shop's logo/contact details itself, so the logo isn't copied per job.
  payload jsonb not null,
  status text not null default 'queued'
    check (status in ('queued', 'printing', 'printed', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  printed_at timestamptz
);

create index if not exists print_jobs_business_status_idx
  on print_jobs(business_id, status, created_at);

alter table print_jobs enable row level security;

create policy "print_jobs_select_own" on print_jobs
  for select using (user_id = auth.uid());
create policy "print_jobs_insert_own" on print_jobs
  for insert with check (user_id = auth.uid());
create policy "print_jobs_update_own" on print_jobs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "print_jobs_delete_own" on print_jobs
  for delete using (user_id = auth.uid());

-- Where "Print label after each sale" sends the label:
--   'phone'   → Print label button → Share Sheet → PeriPage app (0020 behaviour)
--   'station' → queued here, printed automatically by the shop computer
alter table businesses
  add column if not exists print_target text not null default 'phone';
alter table businesses
  add constraint businesses_print_target check (print_target in ('phone', 'station'));

-- Push new jobs to the station instantly (browsers throttle timers in
-- background tabs, so polling alone can lag by a minute).
alter publication supabase_realtime add table print_jobs;
