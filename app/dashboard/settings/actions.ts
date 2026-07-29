'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { getRequestOrigin } from '@/lib/request-origin'
import { sendTeamInviteEmail } from '@/lib/notifications/team-invite-email'

export type SettingsState = { error: string } | { success: true } | undefined

export async function updateProfile(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const name = String(formData.get('name') ?? '').trim()
  const role = String(formData.get('role') ?? '').trim()
  const teamSize = Number(formData.get('team_size'))

  if (!name) return { error: 'Name is required.' }
  if (!role) return { error: 'Position/role is required.' }
  if (!Number.isInteger(teamSize) || teamSize < 1) {
    return { error: 'Team size must be a whole number of at least 1.' }
  }

  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }
  const { userId, db } = session

  const { error } = await db
    .from('profiles')
    .update({ name, role, team_size: teamSize })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type InviteState = { error: string } | { success: true; email: string } | undefined

export async function inviteTeamMember(
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()

  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }

  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }
  const { userId, db } = session

  const { data: profile } = await db.from('profiles').select('name').eq('id', userId).maybeSingle()

  const { data: invite, error } = await db
    .from('team_invites')
    .insert({ inviter_profile_id: userId, invitee_email: email })
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

  revalidatePath('/dashboard/settings')
  return { success: true, email }
}
