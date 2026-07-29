import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Resolves a pending invite (by its id, emailed as a signup link param) into
// the team_id a newly onboarding invitee should join, and marks the invite
// accepted. Runs on the admin client because the invitee has no RLS
// relationship to the inviter's invite row or profile until this resolves —
// see 0010_team_invites.sql for why those tables have no policy that would
// let the invitee read/update them directly.
export async function resolveInviteTeamId(
  inviteId: string,
  inviteeEmail: string
): Promise<string | undefined> {
  const db = createAdminClient()

  const { data: invite } = await db
    .from('team_invites')
    .select('id, inviter_profile_id, invitee_email, status')
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

  return inviterProfile.team_id
}
