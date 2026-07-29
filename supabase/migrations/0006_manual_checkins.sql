-- Manual check-ins: a lightweight interim risk signal for fields that don't
-- have a data integration yet (finance has QuickBooks — see
-- lib/quickbooks and lib/risk-engine). Users periodically answer a short
-- field-specific questionnaire; responses are stored as submitted, with no
-- automated analysis layered on top.
create table if not exists public.manual_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Denormalized from profiles.field at submission time, so a later field
  -- change doesn't reinterpret old answers under a different question set.
  field text not null check (field in ('finance', 'medicine', 'engineering', 'other')),
  -- Question id -> rating from 1 (no concern) to 5 (severe concern).
  responses jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists manual_checkins_profile_created_idx
  on public.manual_checkins (profile_id, created_at desc);

alter table public.manual_checkins enable row level security;

-- Unlike financial_snapshots/risk_flags, these rows are entered directly by
-- the user rather than a service-role ingestion job, so normal owner-scoped
-- policies apply (same pattern as profiles).
create policy "Users can view their own check-ins"
  on public.manual_checkins for select
  using (auth.uid() = profile_id);

create policy "Users can insert their own check-ins"
  on public.manual_checkins for insert
  with check (auth.uid() = profile_id);
