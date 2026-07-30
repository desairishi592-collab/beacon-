-- Schedule risk analysis: schedule_uploads gains the fields needed to run
-- real analysis (full parsed rows, the detected/confirmed column mapping,
-- and whether the manager still needs to confirm it manually), and a new
-- schedule_risk_flags table holds flags tied to schedule_uploads, computed
-- from actual staffing signals rather than manual check-in ratings. Kept
-- distinct from the finance risk_flags table (tied to financial_snapshots,
-- see 0003_risk_flags.sql) since Finance and the other fields now run two
-- independent risk pipelines side by side.

alter table public.schedule_uploads
  add column if not exists rows jsonb not null default '[]'::jsonb,
  add column if not exists column_mapping jsonb not null default '{}'::jsonb,
  add column if not exists needs_mapping boolean not null default false;

create table if not exists public.schedule_risk_flags (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.schedule_uploads (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  signal_type text not null check (
    signal_type in (
      'understaffed_shift',
      'single_point_of_failure',
      'excessive_consecutive_shifts',
      'no_rest_violation',
      'coverage_gap'
    )
  ),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  -- The computed value that triggered the flag (e.g. streak length in days,
  -- rest gap in hours, staffing ratio) and the threshold it crossed.
  metric_value numeric not null,
  threshold_value numeric,
  -- Short machine-readable identifier, e.g. "understaffed_shift:RN:2026-07-29".
  metric_label text not null,
  title text not null,
  explanation text not null,
  recommendation text not null,
  -- The raw signal data the flag was computed from, kept for audit/debugging.
  raw_signal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists schedule_risk_flags_upload_idx on public.schedule_risk_flags (upload_id);
create index if not exists schedule_risk_flags_profile_created_idx on public.schedule_risk_flags (profile_id, created_at desc);

alter table public.schedule_risk_flags enable row level security;

-- Unlike the finance risk_flags (written by a service-role ingestion job),
-- this analysis runs synchronously inside the user's own upload server
-- action, so normal owner-scoped policies apply — same pattern as
-- schedule_uploads.
create policy "Users can view their own schedule risk flags"
  on public.schedule_risk_flags for select
  using (auth.uid() = profile_id);

create policy "Users can insert their own schedule risk flags"
  on public.schedule_risk_flags for insert
  with check (auth.uid() = profile_id);

create policy "Users can delete their own schedule risk flags"
  on public.schedule_risk_flags for delete
  using (auth.uid() = profile_id);
