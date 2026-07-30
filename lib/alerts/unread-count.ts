import 'server-only'
import type { CurrentSession } from '@/lib/current-user'

// An alert is unread when it hasn't been dismissed and has no read_at yet —
// same definition as the unread dot on the Alerts page itself.
export async function getUnreadAlertCount(session: CurrentSession): Promise<number> {
  const { data: flags } = await session.db
    .from('risk_flags')
    .select('id')
    .eq('profile_id', session.userId)

  if (!flags || flags.length === 0) return 0

  const { data: states } = await session.db
    .from('alert_states')
    .select('risk_flag_id, read_at, dismissed_at')
    .eq('profile_id', session.userId)

  const stateByFlagId = new Map((states ?? []).map((state) => [state.risk_flag_id, state]))

  return flags.filter((flag) => {
    const state = stateByFlagId.get(flag.id)
    return !state?.read_at && !state?.dismissed_at
  }).length
}
