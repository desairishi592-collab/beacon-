-- QuickBooks sync run log: one row per sync attempt (manual "Sync now" click
-- or the daily cron job), recording success/failure. Without this, a cron
-- sync that fails overnight (expired token, QuickBooks API downtime) would
-- fail silently — this table plus the Integrations page is where it
-- surfaces instead. Written by the sync job itself (see lib/quickbooks/sync.ts).
create table if not exists public.quickbooks_sync_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  trigger text not null check (trigger in ('manual', 'cron')),
  status text not null check (status in ('success', 'error')),
  snapshots_synced integer not null default 0,
  error_message text,
  started_at timestamptz not null,
  finished_at timestamptz not null default now()
);

create index if not exists quickbooks_sync_runs_profile_finished_idx
  on public.quickbooks_sync_runs (profile_id, finished_at desc);

alter table public.quickbooks_sync_runs enable row level security;

create policy "Users can view their own sync runs"
  on public.quickbooks_sync_runs for select
  using (auth.uid() = profile_id);

-- Writes come from the sync job (service role) — no insert/update policy
-- for regular users.
