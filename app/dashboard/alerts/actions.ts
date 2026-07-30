'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentSession } from '@/lib/current-user'
import { SIGNAL_TYPES } from '@/lib/notifications/channels'
import type { RiskSignalType } from '@/lib/supabase/types'

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

function isRiskSignalType(value: unknown): value is RiskSignalType {
  return typeof value === 'string' && (SIGNAL_TYPES as string[]).includes(value)
}

export async function updateNotificationPreference(
  _prevState: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const signalType = formData.get('signalType')
  if (!isRiskSignalType(signalType)) return { error: 'Missing alert type.' }

  const session = await getCurrentSession()
  if (!session) return { error: 'Not signed in.' }

  const { error } = await session.db
    .from('notification_preferences')
    .upsert(
      { profile_id: session.userId, signal_type: signalType, email_enabled: formData.get('emailEnabled') === 'true' },
      { onConflict: 'profile_id,signal_type' },
    )
  if (error) return { error: error.message }

  revalidatePath('/dashboard/alerts')
  return { success: true }
}
