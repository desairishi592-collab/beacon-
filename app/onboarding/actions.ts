'use server'

import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { resolveInvite } from '@/lib/team-invites'
import type { Field } from '@/lib/supabase/types'

export type OnboardingState = { error: string } | undefined

const VALID_FIELDS: Field[] = ['finance', 'medicine', 'engineering', 'other']

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const name = String(formData.get('name') ?? '').trim()
  const companyName = String(formData.get('company_name') ?? '').trim()
  const role = String(formData.get('role') ?? '').trim()
  const field = String(formData.get('field') ?? '')
  const wantsDataIntegrationRaw = String(formData.get('wants_data_integration') ?? '')
  const inviteId = String(formData.get('invite') ?? '').trim()

  if (!name) return { error: 'Name is required.' }
  if (!companyName) return { error: 'Company name is required.' }
  if (!role) return { error: 'Position/role is required.' }
  if (!VALID_FIELDS.includes(field as Field)) return { error: 'Please select a field.' }
  if (wantsDataIntegrationRaw !== 'yes' && wantsDataIntegrationRaw !== 'no') {
    return { error: 'Let us know if we can integrate with your database/systems.' }
  }
  const wantsDataIntegration = wantsDataIntegrationRaw === 'yes'

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
    company_name: companyName,
    role,
    field: field as Field,
    // Team size isn't asked during onboarding anymore — default to 1 and
    // let the user adjust it later in Settings.
    team_size: 1,
    wants_data_integration: wantsDataIntegration,
    ...(resolved ? { team_id: resolved.teamId, team_role: resolved.role } : {}),
  })

  if (error) {
    return { error: error.message }
  }

  redirect(wantsDataIntegration ? '/dashboard/settings/integrations' : '/dashboard')
}
