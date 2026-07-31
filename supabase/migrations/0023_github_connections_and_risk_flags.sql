-- Engineering's real data integration: GitHub, read-only. Follows the same
-- shape as quickbooks_connections (0004) for the connection, and the same
-- "one dedicated flags table per independent pipeline" convention as
-- schedule_risk_flags (0018) and manual_checkin_risk_flags (0020) rather
-- than overloading the finance-only risk_flags table, which is hard-FK'd to
-- financial_snapshots and whose signal_type CHECK only enumerates finance
-- signal types.
--
-- Read-only by construction: github_connections stores a fine-grained
-- GitHub Personal Access Token the user generates themselves, scoped by
-- them (outside this app, on GitHub) to Contents/Issues/Pull
-- requests/Metadata = Read-only for a single repository. Beacon's own
-- client code (lib/github/client.ts) only ever exposes a GET helper — there
-- is no write path in the module for that token to be used with even if
-- GitHub's own permission boundary were somehow bypassed.
create table if not exists public.github_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  access_token text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint github_connections_unique_profile unique (profile_id)
);

alter table public.github_connections enable row level security;

-- No policies: the token is never read by the client. All access goes
-- through the service role (connect/disconnect actions, the sync job, and
-- the status check the Integrations page needs — which reads only
-- non-sensitive columns via that role), same pattern as
-- quickbooks_connections.

create trigger github_connections_set_updated_at
  before update on public.github_connections
  for each row
  execute function public.set_updated_at();

-- One row per sync run, holding the aggregated metrics the risk engine
-- reads. Not tied to a calendar period like financial_snapshots — GitHub
-- activity doesn't have a natural accounting period — so periods here are
-- just "as of this sync," compared against the previous sync's row for
-- period-over-period signals (see lib/github-risk-engine/signals.ts).
create table if not exists public.engineering_snapshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  synced_at timestamptz not null default now(),
  open_pr_count integer not null default 0,
  oldest_open_pr_days numeric,
  oldest_open_pr_number integer,
  oldest_open_pr_title text,
  open_critical_issue_count integer not null default 0,
  oldest_critical_issue_days numeric,
  oldest_critical_issue_number integer,
  oldest_critical_issue_title text,
  commits_last_30_days integer not null default 0,
  source text not null default 'github',
  created_at timestamptz not null default now()
);

create index if not exists engineering_snapshots_profile_synced_idx
  on public.engineering_snapshots (profile_id, synced_at desc);

alter table public.engineering_snapshots enable row level security;

create policy "Users can view their own engineering snapshots"
  on public.engineering_snapshots for select
  using (auth.uid() = profile_id);

-- Writes come from the sync job (service role), which bypasses RLS — no
-- insert/update policy for regular users, matching financial_snapshots.

create table if not exists public.engineering_risk_flags (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.engineering_snapshots (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  signal_type text not null check (
    signal_type in ('stale_pull_requests', 'unresolved_critical_issues', 'deploy_frequency_drop')
  ),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  -- The computed value that triggered the flag (e.g. oldest open PR age in
  -- days, oldest critical issue age in days, or the period-over-period
  -- commit-frequency drop as a fraction) and the threshold it crossed.
  metric_value numeric not null,
  threshold_value numeric,
  -- Short machine-readable identifier, e.g. "stale_pull_requests:oldest_age".
  metric_label text not null,
  title text not null,
  explanation text not null,
  recommendation text not null,
  raw_signal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists engineering_risk_flags_snapshot_idx on public.engineering_risk_flags (snapshot_id);
create index if not exists engineering_risk_flags_profile_created_idx
  on public.engineering_risk_flags (profile_id, created_at desc);

alter table public.engineering_risk_flags enable row level security;

create policy "Users can view their own engineering risk flags"
  on public.engineering_risk_flags for select
  using (auth.uid() = profile_id);

-- Writes come from the sync job (service role), same as risk_flags.
