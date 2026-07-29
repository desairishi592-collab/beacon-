-- Notification preferences: per-user, per-signal-type control over whether
-- an alert also goes out by email (critical/high severity flags do, by
-- default — see lib/notifications/risk-flag-email.ts) or stays in-app only.
-- Absence of a row for a given signal_type means the default (email
-- enabled) applies, so this table only needs to persist explicit opt-outs.
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  signal_type text not null check (
    signal_type in ('cash_runway', 'burn_rate', 'dscr', 'expense_concentration', 'anomaly')
  ),
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, signal_type)
);

create index if not exists notification_preferences_profile_idx
  on public.notification_preferences (profile_id);

alter table public.notification_preferences enable row level security;

create policy "Users can view their own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = profile_id);

create policy "Users can create their own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = profile_id);

create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Reuses the trigger function defined in 0001_profiles.sql.
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row
  execute function public.set_updated_at();
