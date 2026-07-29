'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { getRequestOrigin } from '@/lib/request-origin'
import { sendTeamInviteEmail } from '@/lib/notifications/team-invite-email'
import { removeTeamMember as removeTeamMemberRow, type TeamActionState } from '@/lib/team-invites'
import type { TeamRole } from '@/lib/supabase/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES: TeamRole[] = ['admin', 'member']

export type InviteState = { error: string } | { success: true; email: string } | undefined

export async function inviteTeamMember(
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = String(formData.get('role') ?? 'member').trim()

  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }
  if (!VALID_ROLES.includes(role as TeamRole)) return { error: 'Select a valid role.' }

  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }
  const { userId, db } = session

  const { data: profile } = await db
    .from('profiles')
    .select('name, team_role')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.team_role !== 'admin') {
    return { error: 'Only a team admin can invite new members.' }
  }

  const { data: invite, error } = await db
    .from('team_invites')
    .insert({ inviter_profile_id: userId, invitee_email: email, role: role as TeamRole })
    .select('id')
    .single()

  if (error || !invite) return { error: error?.message ?? 'Could not create invite.' }

  try {
    const origin = await getRequestOrigin()
    await sendTeamInviteEmail({
      inviteId: invite.id,
      inviteeEmail: email,
      inviterName: profile?.name ?? 'A Beacon manager',
      origin,
    })
  } catch {
    // Don't leave a pending invite the invitee never actually received.
    await db.from('team_invites').delete().eq('id', invite.id)
    return { error: 'Could not send the invite email. Please try again.' }
  }

  revalidatePath('/dashboard/organization')
  return { success: true, email }
}

export async function revokeInvite(
  _prevState: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const inviteId = String(formData.get('invite_id') ?? '').trim()
  if (!inviteId) return { error: 'Missing invite.' }

  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }
  const { userId, db } = session

  // RLS ("Users can revoke their own pending invites") only allows this to
  // succeed for a pending invite this account sent, so no extra ownership
  // check is needed here — a mismatch just updates zero rows.
  const { data, error } = await db
    .from('team_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('inviter_profile_id', userId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Invite not found or already resolved.' }

  revalidatePath('/dashboard/organization')
  return { success: true }
}

const REMOVE_MEMBER_ERRORS: Record<string, string> = {
  not_admin: 'Only a team admin can remove members.',
  not_teammate: 'That person is not on your team.',
  not_found: 'Could not remove that team member.',
  is_admin: 'Could not remove that team member.',
}

export async function removeTeamMember(
  _prevState: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const memberId = String(formData.get('member_id') ?? '').trim()
  if (!memberId) return { error: 'Missing team member.' }

  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  const result = await removeTeamMemberRow(session.userId, memberId)
  if (result) return { error: REMOVE_MEMBER_ERRORS[result] }

  revalidatePath('/dashboard/organization')
  revalidatePath('/dashboard/team')
  return { success: true }
}
