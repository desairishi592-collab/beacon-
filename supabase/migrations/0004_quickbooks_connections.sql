-- QuickBooks OAuth connections: one row per profile, holding the tokens
-- needed to call the QuickBooks API on their behalf. Populated by the
-- OAuth callback and kept fresh by the sync job (see lib/quickbooks).
create table if not exists public.quickbooks_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  realm_id text not null,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quickbooks_connections_unique_profile unique (profile_id)
);

alter table public.quickbooks_connections enable row level security;

-- No policies: tokens are never read by the client. All access goes through
-- the service role (OAuth callback, sync job, and any status check the
-- dashboard needs — which reads only non-sensitive columns via that role).

create trigger quickbooks_connections_set_updated_at
  before update on public.quickbooks_connections
  for each row
  execute function public.set_updated_at();
