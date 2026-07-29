import 'server-only'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TeamRole } from '@/lib/supabase/types'

export type ResolvedInvite = { teamId: string; role: TeamRole }

// Resolves a pending invite (by its id, emailed as a signup link param) into
// the team_id/role a newly onboarding invitee should join with, and marks
// the invite accepted. Runs on the admin client because the invitee has no
// RLS relationship to the inviter's invite row or profile until this
// resolves — see 0010_team_invites.sql for why those tables have no policy
// that would let the invitee read/update them directly.
export async function resolveInvite(
  inviteId: string,
  inviteeEmail: string
): Promise<ResolvedInvite | undefined> {
  const db = createAdminClient()

  const { data: invite } = await db
    .from('team_invites')
    .select('id, inviter_profile_id, invitee_email, status, role')
    .eq('id', inviteId)
    .maybeSingle()

  if (
    !invite ||
    invite.status !== 'pending' ||
    invite.invitee_email.toLowerCase() !== inviteeEmail.toLowerCase()
  ) {
    return undefined
  }

  const { data: inviterProfile } = await db
    .from('profiles')
    .select('team_id')
    .eq('id', invite.inviter_profile_id)
    .maybeSingle()

  if (!inviterProfile) return undefined

  await db.from('team_invites').update({ status: 'accepted' }).eq('id', invite.id)

  return { teamId: inviterProfile.team_id, role: invite.role }
}

export type TeamMembershipError = 'not_admin' | 'not_teammate' | 'not_found' | 'is_admin'

// Shared result shape for the team-membership server actions (invite revoke,
// member remove, leave team) that back ConfirmActionButton.
export type TeamActionState = { error: string } | { success: true } | undefined

// Removes a teammate from the admin's team, resetting them to a fresh solo
// team (a "team of one", same as any never-invited profile gets by
// default). Runs on the admin client because it writes another account's
// profile row — 0012_team_roles_and_management.sql blocks that column
// change from the regular user-scoped client entirely, so authorization
// happens here in application code instead of RLS.
export async function removeTeamMember(
  adminProfileId: string,
  memberProfileId: string
): Promise<TeamMembershipError | undefined> {
  if (adminProfileId === memberProfileId) return 'not_admin'

  const db = createAdminClient()

  const { data: admin } = await db
    .from('profiles')
    .select('team_id, team_role')
    .eq('id', adminProfileId)
    .maybeSingle()

  if (!admin || admin.team_role !== 'admin') return 'not_admin'

  const { data: member } = await db
    .from('profiles')
    .select('team_id')
    .eq('id', memberProfileId)
    .maybeSingle()

  if (!member) return 'not_found'
  if (member.team_id !== admin.team_id) return 'not_teammate'

  const { error } = await db
    .from('profiles')
    .update({ team_id: randomUUID(), team_role: 'admin' })
    .eq('id', memberProfileId)

  if (error) return 'not_found'
  return undefined
}

// Lets a member leave their current team, resetting them to a fresh solo
// team. Same admin-client rationale as removeTeamMember — team_id/team_role
// aren't writable from the regular client even on your own row.
export async function leaveTeam(memberProfileId: string): Promise<TeamMembershipError | undefined> {
  const db = createAdminClient()

  const { data: member } = await db
    .from('profiles')
    .select('team_role')
    .eq('id', memberProfileId)
    .maybeSingle()

  if (!member) return 'not_found'
  if (member.team_role !== 'member') return 'is_admin'

  const { error } = await db
    .from('profiles')
    .update({ team_id: randomUUID(), team_role: 'admin' })
    .eq('id', memberProfileId)

  if (error) return 'not_found'
  return undefined
}
