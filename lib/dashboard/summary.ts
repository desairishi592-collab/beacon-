import 'server-only'
import type { CurrentSession } from '@/lib/current-user'

export type OverallStatus = 'healthy' | 'needs_attention'

export type DashboardSummary = {
  overallStatus: OverallStatus
  lastActivityAt: string | null
  isCheckInOverdue: boolean
}

// Same 7-day threshold as the weekly reminder cron (REMINDER_INTERVAL_DAYS
// in lib/notifications/check-in-reminder.ts) — duplicated rather than
// imported since that module belongs to the cron/notifications path.
const CHECK_IN_OVERDUE_DAYS = 7

export async function getDashboardSummary(session: CurrentSession): Promise<DashboardSummary> {
  const { data: checkin } = await session.db
    .from('manual_checkins')
    .select('created_at')
    .eq('profile_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastActivityAt = checkin?.created_at ?? null

  const isCheckInOverdue =
    lastActivityAt === null ||
    Date.now() - new Date(lastActivityAt).getTime() >= CHECK_IN_OVERDUE_DAYS * 24 * 60 * 60 * 1000

  return {
    overallStatus: isCheckInOverdue ? 'needs_attention' : 'healthy',
    lastActivityAt,
    isCheckInOverdue,
  }
}
