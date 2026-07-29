-- team_invites has no way to record which team_role the invitee should get,
-- so every accepted invite silently landed the new profile on the
-- team_role column default ('admin', from 0012_team_roles_and_management.sql)
-- regardless of what the inviting admin intended. This lets the admin pick
-- a role when sending the invite; resolveInvite (lib/team-invites.ts) reads
-- it back and completeOnboarding applies it to the new profile.
alter table public.team_invites
  add column if not exists role text not null default 'member'
    check (role in ('admin', 'member'));
