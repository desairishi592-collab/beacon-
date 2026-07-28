'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  if (!name) return { error: 'Name is required.' }
  if (!role) return { error: 'Position/role is required.' }
  if (!VALID_FIELDS.includes(field as Field)) return { error: 'Please select a field.' }
  if (!Number.isInteger(teamSize) || teamSize < 1) {
    return { error: 'Team size must be a whole number of at least 1.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    name,
    role,
    field: field as Field,
    team_size: teamSize,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
