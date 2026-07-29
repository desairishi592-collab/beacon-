-- Risk flags: the plain-language output of the risk analysis engine
-- (lib/risk-engine), one row per flagged signal on a financial_snapshots
-- row. profile_id is denormalized from the snapshot so RLS doesn't need a
-- join, matching the pattern used elsewhere in this schema.
create table if not exists public.risk_flags (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.financial_snapshots (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  signal_type text not null check (
    signal_type in ('cash_runway', 'burn_rate', 'dscr', 'expense_concentration', 'anomaly')
  ),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  -- The computed value that triggered the flag (e.g. runway in months, DSCR
  -- ratio, expense share as a fraction) and the threshold it crossed.
  metric_value numeric not null,
  threshold_value numeric,
  -- Short machine-readable identifier for the specific metric, e.g.
  -- "expense_concentration:payroll" or "anomaly:total_revenue".
  metric_label text not null,
  -- LLM-authored plain-language explanation.
  title text not null,
  explanation text not null,
  recommendation text not null,
  -- The raw signal data passed to the LLM, kept for audit/debugging.
  raw_signal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists risk_flags_snapshot_idx on public.risk_flags (snapshot_id);
create index if not exists risk_flags_profile_created_idx on public.risk_flags (profile_id, created_at desc);

alter table public.risk_flags enable row level security;

create policy "Users can view their own risk flags"
  on public.risk_flags for select
  using (auth.uid() = profile_id);

-- Writes come from the risk analysis engine (service role), which bypasses
-- RLS — no insert/update policy for regular users.
