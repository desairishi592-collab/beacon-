-- Financial snapshots: one row per profile per reporting period (typically
-- monthly), populated by the QuickBooks ingestion job. The risk analysis
-- engine reads a snapshot plus its immediately preceding period to compute
-- risk signals (see lib/risk-engine).
create table if not exists public.financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  cash_balance numeric not null,
  total_revenue numeric not null,
  total_expenses numeric not null,
  operating_income numeric not null,
  total_debt_service numeric not null default 0,
  -- Category name -> amount for the period, e.g. {"payroll": 42000, "rent": 6000}.
  -- Drives the expense-concentration signal.
  expense_breakdown jsonb not null default '{}'::jsonb,
  source text not null default 'quickbooks',
  created_at timestamptz not null default now(),
  constraint financial_snapshots_period_valid check (period_end > period_start),
  constraint financial_snapshots_debt_service_non_negative check (total_debt_service >= 0),
  -- One snapshot per profile per period end date, so "the prior period" is
  -- unambiguous: the row with the largest period_end below this one.
  constraint financial_snapshots_unique_period unique (profile_id, period_end)
);

create index if not exists financial_snapshots_profile_period_idx
  on public.financial_snapshots (profile_id, period_end desc);

alter table public.financial_snapshots enable row level security;

create policy "Users can view their own financial snapshots"
  on public.financial_snapshots for select
  using (auth.uid() = profile_id);

-- Writes come from the ingestion job (service role), which bypasses RLS —
-- no insert/update policy for regular users.
