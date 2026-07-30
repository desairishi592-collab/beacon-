-- Manual check-in risk flags: the first automated analysis layered on top
-- of manual_checkins (see 0006_manual_checkins.sql, whose comment noted
-- responses were "stored as submitted, with no automated analysis layered
-- on top" — this migration is that analysis). Any question rated moderate
-- concern (3) or worse becomes a flag, one row per flagged question per
-- check-in submission. Kept distinct from risk_flags/schedule_risk_flags
-- since Finance, schedule uploads, and manual check-ins are three
-- independent risk pipelines side by side.
create table if not exists public.manual_checkin_risk_flags (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.manual_checkins (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  signal_type text not null check (signal_type = 'checkin_concern'),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  -- The 1-5 rating that triggered the flag and the moderate-concern threshold
  -- it crossed (see MODERATE_RATING_THRESHOLD in lib/check-ins/severity.ts).
  metric_value numeric not null,
  threshold_value numeric,
  -- Short machine-readable identifier, e.g. "checkin_concern:patient_safety".
  metric_label text not null,
  title text not null,
  explanation text not null,
  -- AI-authored plain-language fix, tailored to the question, rating, and
  -- any free-text notes on the check-in.
  recommendation text not null,
  raw_signal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists manual_checkin_risk_flags_checkin_idx
  on public.manual_checkin_risk_flags (checkin_id);
create index if not exists manual_checkin_risk_flags_profile_created_idx
  on public.manual_checkin_risk_flags (profile_id, created_at desc);

alter table public.manual_checkin_risk_flags enable row level security;

-- This analysis runs synchronously inside the user's own check-in submit
-- action, so normal owner-scoped policies apply — same pattern as
-- manual_checkins and schedule_risk_flags.
create policy "Users can view their own check-in risk flags"
  on public.manual_checkin_risk_flags for select
  using (auth.uid() = profile_id);

create policy "Users can insert their own check-in risk flags"
  on public.manual_checkin_risk_flags for insert
  with check (auth.uid() = profile_id);
