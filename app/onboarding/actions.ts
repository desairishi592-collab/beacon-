'use server'

import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { resolveInviteTeamId } from '@/lib/team-invites'
import type { Field } from '@/lib/supabase/types'

export type OnboardingState = { error: string } | undefined

const VALID_FIELDS: Field[] = ['finance', 'medicine', 'engineering', 'other']

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const name = String(formData.get('name') ?? '').trim()
  const role = String(formData.get('role') ?? '').trim()
  const field = String(formData.get('field') ?? '')
  const teamSize = Number(formData.get('team_size'))
  const inviteId = String(formData.get('invite') ?? '').trim()

  if (!name) return { error: 'Name is required.' }
  if (!role) return { error: 'Position/role is required.' }
  if (!VALID_FIELDS.includes(field as Field)) return { error: 'Please select a field.' }
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
  // inviter's team instead of getting a fresh solo team_id.
  let teamId: string | undefined
  if (inviteId) {
    const {
      data: { user },
    } = await db.auth.getUser()
    if (user?.email) {
      teamId = await resolveInviteTeamId(inviteId, user.email)
    }
  }

  const { error } = await db.from('profiles').upsert({
    id: userId,
    name,
    role,
    field: field as Field,
    team_size: teamSize,
    ...(teamId ? { team_id: teamId } : {}),
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
