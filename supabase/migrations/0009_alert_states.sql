-- Alert states: per-user read/dismissed tracking for risk_flags, surfaced
-- on the Alerts page. Kept as its own table rather than columns on
-- risk_flags since risk_flags rows are written by the risk analysis engine
-- (service role) and are otherwise read-only to users; this table is the
-- one place regular users can write.
create table if not exists public.alert_states (
  id uuid primary key default gen_random_uuid(),
  risk_flag_id uuid not null references public.risk_flags (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (risk_flag_id, profile_id)
);

create index if not exists alert_states_profile_idx on public.alert_states (profile_id);

alter table public.alert_states enable row level security;

create policy "Users can view their own alert states"
  on public.alert_states for select
  using (auth.uid() = profile_id);

create policy "Users can create their own alert states"
  on public.alert_states for insert
  with check (auth.uid() = profile_id);

create policy "Users can update their own alert states"
  on public.alert_states for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
