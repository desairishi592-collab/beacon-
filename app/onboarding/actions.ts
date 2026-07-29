'use server'

import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { resolveInvite } from '@/lib/team-invites'

export type OnboardingState = { error: string } | undefined

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const name = String(formData.get('name') ?? '').trim()
  const role = String(formData.get('role') ?? '').trim()
  const teamSize = Number(formData.get('team_size'))
  const inviteId = String(formData.get('invite') ?? '').trim()

  if (!name) return { error: 'Name is required.' }
  if (!role) return { error: 'Position/role is required.' }
  if (!Number.isInteger(teamSize) || teamSize < 1) {
    return { error: 'Team size must be a whole number of at least 1.' }
  }

  const session = await getCurrentSession()
  if (!session) {
    redirect('/login')
  }
  const { userId, db } = session

  // A signup link from an invite email carries the invite id — if it still
  // resolves to a pending invite for this account's email, join the
  // inviter's team (with the role the admin assigned) instead of getting a
  // fresh solo team_id/default admin role.
  let resolved: Awaited<ReturnType<typeof resolveInvite>>
  if (inviteId) {
    const {
      data: { user },
    } = await db.auth.getUser()
    if (user?.email) {
      resolved = await resolveInvite(inviteId, user.email)
    }
  }

  const { error } = await db.from('profiles').upsert({
    id: userId,
    name,
    role,
    field: 'medicine',
    team_size: teamSize,
    ...(resolved ? { team_id: resolved.teamId, team_role: resolved.role } : {}),
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
