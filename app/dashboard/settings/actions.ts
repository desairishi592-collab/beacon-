'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'

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
