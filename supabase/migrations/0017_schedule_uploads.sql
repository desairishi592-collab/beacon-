-- Schedule uploads: the "generic scheduling system CSV upload" integration
-- path on the integrations screen (see app/dashboard/integrations). One row
-- per manager, replaced on each new upload (same single-connection model as
-- the old quickbooks_connections table) — only a parsed summary is kept,
-- not the raw file, since this is a display-only v1 with no analysis layer.
create table if not exists public.schedule_uploads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  filename text not null,
  row_count integer not null,
  columns text[] not null,
  preview_rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.schedule_uploads enable row level security;

-- Entered directly by the user (parsed client-uploaded file, not a
-- service-role ingestion job), so normal owner-scoped policies apply — same
-- pattern as manual_checkins.
create policy "Users can view their own schedule upload"
  on public.schedule_uploads for select
  using (auth.uid() = profile_id);

create policy "Users can insert their own schedule upload"
  on public.schedule_uploads for insert
  with check (auth.uid() = profile_id);

create policy "Users can update their own schedule upload"
  on public.schedule_uploads for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Users can delete their own schedule upload"
  on public.schedule_uploads for delete
  using (auth.uid() = profile_id);
