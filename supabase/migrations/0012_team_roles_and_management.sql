-- Team roles + management: profiles gained team_id in 0010_team_invites.sql
-- but no notion of who's actually in charge of a team. This adds an
-- admin/member role so a manager can invite/revoke/remove, members can
-- leave, and admins get read access to their teammates' manual check-ins
-- (the only shared-visibility surface — financial_snapshots/risk_flags/
-- QuickBooks stay untouched and profile-scoped).
alter table public.profiles
  add column if not exists team_role text not null default 'admin'
    check (team_role in ('admin', 'member'));

-- team_id/team_role define team membership and who can see whose data, so
-- they can't be left to the blanket "users can update their own profile"
-- policy below (a member could otherwise set their own team_id to any
-- other team and grant that team's admin visibility into their rows, or
-- just self-promote to admin). All legitimate transitions — accepting an
-- invite, leaving a team, being removed — go through the admin client
-- (see lib/team-invites.ts), which connects as the service role and skips
-- this trigger.
create or replace function public.prevent_self_service_team_changes()
returns trigger
language plpgsql
as $$
begin
  if (new.team_id is distinct from old.team_id or new.team_role is distinct from old.team_role)
     and auth.role() is distinct from 'service_role' then
    raise exception 'team_id and team_role can only change via the team invite/removal flow';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_service_team_changes
  before update on public.profiles
  for each row
  execute function public.prevent_self_service_team_changes();

-- Lets an admin revoke a still-pending invite. Acceptance still goes
-- through the admin client (see resolveInviteTeamId), so this only needs
-- to allow the inviter to move their own pending invite to revoked.
alter table public.team_invites drop constraint if exists team_invites_status_check;
alter table public.team_invites
  add constraint team_invites_status_check check (status in ('pending', 'accepted', 'revoked'));

create policy "Users can revoke their own pending invites"
  on public.team_invites for update
  using (auth.uid() = inviter_profile_id and status = 'pending')
  with check (auth.uid() = inviter_profile_id and status = 'revoked');

-- team_invites has had RLS enabled with no delete policy since
-- 0010_team_invites.sql, so inviteTeamMember's SendGrid-failure rollback
-- (a plain .delete() on the user-scoped client) has always silently
-- deleted zero rows, leaving an orphaned pending invite behind. Fixing
-- that here since it's the same table/flow this migration already touches.
create policy "Users can delete their own pending invites"
  on public.team_invites for delete
  using (auth.uid() = inviter_profile_id and status = 'pending');

-- Only a team admin (the manager) can invite. This was previously any
-- authenticated user with a profile — tighten it at the RLS layer too,
-- not just in the server action, since anyone with the anon key and a
-- session JWT can call PostgREST directly.
drop policy if exists "Users can create invites as themselves" on public.team_invites;

create policy "Team admins can create invites as themselves"
  on public.team_invites for insert
  with check (
    auth.uid() = inviter_profile_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and team_role = 'admin'
    )
  );

-- Helper functions for team-scoped visibility. Both are security definer
-- so they bypass RLS internally — without that, a policy on `profiles`
-- that subqueries `profiles` (or a policy on `manual_checkins` that
-- subqueries `profiles`) would recurse into the very policies being
-- evaluated.
create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and team_role = 'admin'
      and team_id = target_team_id
  );
$$;

create or replace function public.profile_team_id(target_profile_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select team_id from public.profiles where id = target_profile_id;
$$;

create policy "Team admins can view teammates' profiles"
  on public.profiles for select
  using (public.is_team_admin(team_id));

create policy "Team admins can view teammates' check-ins"
  on public.manual_checkins for select
  using (public.is_team_admin(public.profile_team_id(profile_id)));
