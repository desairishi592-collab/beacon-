import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { AlertsList, type AlertItem } from './alerts-list'
import { NotificationPreferences } from './notification-preferences'
import { SIGNAL_TYPES } from '@/lib/notifications/channels'
import type { NotificationPreference } from '@/lib/supabase/types'

export default async function AlertsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')

  const { data: flags } = await session.db
    .from('risk_flags')
    .select('*')
    .eq('profile_id', session.userId)
    .order('created_at', { ascending: false })

  const { data: states } = await session.db
    .from('alert_states')
    .select('*')
    .eq('profile_id', session.userId)

  const { data: preferenceRows } = await session.db
    .from('notification_preferences')
    .select('*')
    .eq('profile_id', session.userId)

  const stateByFlagId = new Map((states ?? []).map((state) => [state.risk_flag_id, state]))

  const alerts: AlertItem[] = (flags ?? []).map((flag) => ({
    flag,
    state: stateByFlagId.get(flag.id) ?? null,
  }))

  const preferenceByType = new Map((preferenceRows ?? []).map((pref) => [pref.signal_type, pref]))
  const preferences: NotificationPreference[] = SIGNAL_TYPES.map(
    (signalType) =>
      preferenceByType.get(signalType) ?? {
        id: signalType,
        profile_id: session.userId,
        signal_type: signalType,
        email_enabled: true,
        created_at: '',
        updated_at: '',
      },
  )

  const emailDisabledTypes = preferences.filter((pref) => !pref.email_enabled).map((pref) => pref.signal_type)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Every risk signal from your synced financials, past and present. Mark alerts as read or dismiss
          the ones you&apos;ve handled.
        </p>
      </div>

      <AlertsList alerts={alerts} emailDisabledTypes={emailDisabledTypes} />

      <NotificationPreferences preferences={preferences} />
    </div>
  )
}
