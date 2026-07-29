import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { AlertsList, type AlertItem } from './alerts-list'

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

  const stateByFlagId = new Map((states ?? []).map((state) => [state.risk_flag_id, state]))

  const alerts: AlertItem[] = (flags ?? [])
    .map((flag) => ({ flag, state: stateByFlagId.get(flag.id) ?? null }))
    .filter(({ state }) => !state?.dismissed_at)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Risk signals from your synced financials. Mark alerts as read or dismiss the ones you&apos;ve
          handled.
        </p>
      </div>

      <AlertsList alerts={alerts} />
    </div>
  )
}
