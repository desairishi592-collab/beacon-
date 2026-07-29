'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { leaveTeam as leaveTeamRow, type TeamActionState } from '@/lib/team-invites'

export type SettingsState = { error: string } | { success: true } | undefined

export async function updateProfile(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const name = String(formData.get('name') ?? '').trim()
  const role = String(formData.get('role') ?? '').trim()
  const teamSize = Number(formData.get('team_size'))
  // Unchecked checkboxes are omitted from FormData entirely, not sent as
  // 'false' — presence is the signal.
  const weeklyDigestEnabled = formData.get('weekly_digest_enabled') === 'on'
  const checkInReminderEnabled = formData.get('check_in_reminder_enabled') === 'on'

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
    .update({
      name,
      role,
      team_size: teamSize,
      weekly_digest_enabled: weeklyDigestEnabled,
      check_in_reminder_enabled: checkInReminderEnabled,
    })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

const LEAVE_TEAM_ERRORS: Record<string, string> = {
  not_admin: 'Could not leave the team.',
  not_teammate: 'Could not leave the team.',
  not_found: 'Could not leave the team.',
  is_admin: 'Team admins can’t leave their team.',
}

export async function leaveTeam(
  _prevState: TeamActionState,
  _formData: FormData
): Promise<TeamActionState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  const result = await leaveTeamRow(session.userId)
  if (result) return { error: LEAVE_TEAM_ERRORS[result] }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { success: true }
}
