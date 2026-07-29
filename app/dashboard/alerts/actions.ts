'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'

export type AlertActionState = { error: string } | { success: true } | undefined

async function upsertAlertState(
  riskFlagId: string,
  patch: { read_at?: string; dismissed_at?: string },
): Promise<AlertActionState> {
  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  const { error } = await session.db
    .from('alert_states')
    .upsert(
      { profile_id: session.userId, risk_flag_id: riskFlagId, ...patch },
      { onConflict: 'risk_flag_id,profile_id' },
    )
  if (error) return { error: error.message }

  revalidatePath('/dashboard/alerts')
  return { success: true }
}

export async function markAlertRead(
  _prevState: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const riskFlagId = formData.get('riskFlagId')
  if (typeof riskFlagId !== 'string') return { error: 'Missing alert.' }

  return upsertAlertState(riskFlagId, { read_at: new Date().toISOString() })
}

export async function dismissAlert(
  _prevState: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const riskFlagId = formData.get('riskFlagId')
  if (typeof riskFlagId !== 'string') return { error: 'Missing alert.' }

  return upsertAlertState(riskFlagId, { dismissed_at: new Date().toISOString() })
}
