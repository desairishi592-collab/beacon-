-- Team invites: lets a manager invite teammates to Beacon. profiles has no
-- existing team/org concept (team_size is just a self-reported headcount —
-- see 0001_profiles.sql), so this adds team_id to group invited members
-- with their inviter. Every profile defaults to its own team_id (a solo
-- "team of one"); accepting an invite during onboarding overwrites it with
-- the inviter's team_id instead (see lib/team-invites.ts).
alter table public.profiles
  add column if not exists team_id uuid not null default gen_random_uuid();

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_profile_id uuid not null references public.profiles (id) on delete cascade,
  invitee_email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now()
);

create index if not exists team_invites_inviter_created_idx
  on public.team_invites (inviter_profile_id, created_at desc);

alter table public.team_invites enable row level security;

create policy "Users can view invites they sent"
  on public.team_invites for select
  using (auth.uid() = inviter_profile_id);

create policy "Users can create invites as themselves"
  on public.team_invites for insert
  with check (auth.uid() = inviter_profile_id);

-- Acceptance happens during the invitee's onboarding, before they have any
-- row-level relationship to this invite (they aren't the inviter) — that
-- update goes through the admin client instead, so no update policy for
-- regular users.
