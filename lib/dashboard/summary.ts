import 'server-only'
import type { CurrentSession } from '@/lib/current-user'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RiskSeverity } from '@/lib/supabase/types'

export type RiskFlagCounts = Record<RiskSeverity, number>

export type OverallStatus = 'healthy' | 'needs_attention' | 'critical'

// Mirrors an open, undismissed risk_flags row where signal_type is
// 'cash_runway' and severity is 'critical' (runway < 1 month — see
// RUNWAY_CRITICAL_MONTHS in lib/risk-engine/signals.ts). title/runwayMonths
// come straight off that row, no new computation.
export type UrgentIndicator =
  | { kind: 'cash_runway_critical'; runwayMonths: number; title: string }
  | { kind: 'check_in_overdue' }

export type DashboardSummary = {
  riskFlagCounts: RiskFlagCounts
  overallStatus: OverallStatus
  lastActivityAt: string | null
  lastActivityLabel: 'sync' | 'check-in'
  urgentIndicator: UrgentIndicator | null
}

const SEVERITY_RANK: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

// Same 7-day threshold as the weekly reminder cron (REMINDER_INTERVAL_DAYS
// in lib/notifications/check-in-reminder.ts) — duplicated rather than
// imported since that module belongs to the cron/notifications path.
const CHECK_IN_OVERDUE_DAYS = 7

// "Open" mirrors the Alerts page's dismissal semantics (app/dashboard/alerts) —
// a flag stays open until it's explicitly dismissed, independent of read state.
async function getOpenRiskFlagCounts(session: CurrentSession): Promise<{
  counts: RiskFlagCounts
  highestSeverity: RiskSeverity | null
  criticalCashRunway: { runwayMonths: number; title: string } | null
}> {
  const counts: RiskFlagCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  let highestSeverity: RiskSeverity | null = null
  let criticalCashRunway: { runwayMonths: number; title: string } | null = null

  const { data: flags } = await session.db
    .from('risk_flags')
    .select('id, severity, signal_type, metric_value, title')
    .eq('profile_id', session.userId)

  if (!flags || flags.length === 0) {
    return { counts, highestSeverity, criticalCashRunway }
  }

  const { data: states } = await session.db
    .from('alert_states')
    .select('risk_flag_id, dismissed_at')
    .eq('profile_id', session.userId)

  const dismissedFlagIds = new Set(
    (states ?? []).filter((state) => state.dismissed_at).map((state) => state.risk_flag_id),
  )

  for (const flag of flags) {
    if (dismissedFlagIds.has(flag.id)) continue
    counts[flag.severity] += 1
    if (!highestSeverity || SEVERITY_RANK[flag.severity] < SEVERITY_RANK[highestSeverity]) {
      highestSeverity = flag.severity
    }
    if (flag.signal_type === 'cash_runway' && flag.severity === 'critical') {
      criticalCashRunway = { runwayMonths: flag.metric_value, title: flag.title }
    }
  }

  return { counts, highestSeverity, criticalCashRunway }
}

// Finance-track users get their "last activity" from QuickBooks sync;
// everyone else gets it from their most recent manual check-in — same
// field split as isManualCheckinField (lib/check-ins/questions.ts).
async function getLastActivityAt(session: CurrentSession, isFinance: boolean): Promise<string | null> {
  if (isFinance) {
    // quickbooks_connections has no user-facing select policy (it holds
    // bearer tokens) — read through the service role, matching the pattern
    // in app/dashboard/_components/financial-overview.tsx.
    const db = createAdminClient()
    const { data: connection } = await db
      .from('quickbooks_connections')
      .select('last_synced_at')
      .eq('profile_id', session.userId)
      .maybeSingle()
    return connection?.last_synced_at ?? null
  }

  const { data: checkin } = await session.db
    .from('manual_checkins')
    .select('created_at')
    .eq('profile_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return checkin?.created_at ?? null
}

export async function getDashboardSummary(
  session: CurrentSession,
  isFinance: boolean,
): Promise<DashboardSummary> {
  // Risk flags only ever exist for finance-track profiles today (they're
  // derived from QuickBooks financial snapshots) — skip the extra queries
  // for other fields, same guard as getUnreadAlertCount's caller in layout.tsx.
  const { counts, highestSeverity, criticalCashRunway } = isFinance
    ? await getOpenRiskFlagCounts(session)
    : {
        counts: { critical: 0, high: 0, medium: 0, low: 0 } as RiskFlagCounts,
        highestSeverity: null,
        criticalCashRunway: null,
      }

  const overallStatus: OverallStatus =
    highestSeverity === 'critical' ? 'critical' : highestSeverity ? 'needs_attention' : 'healthy'

  const lastActivityAt = await getLastActivityAt(session, isFinance)

  const isCheckinOverdue =
    !isFinance &&
    (lastActivityAt === null ||
      Date.now() - new Date(lastActivityAt).getTime() >= CHECK_IN_OVERDUE_DAYS * 24 * 60 * 60 * 1000)

  const urgentIndicator: UrgentIndicator | null = criticalCashRunway
    ? { kind: 'cash_runway_critical', runwayMonths: criticalCashRunway.runwayMonths, title: criticalCashRunway.title }
    : isCheckinOverdue
      ? { kind: 'check_in_overdue' }
      : null

  return {
    riskFlagCounts: counts,
    overallStatus,
    lastActivityAt,
    lastActivityLabel: isFinance ? 'sync' : 'check-in',
    urgentIndicator,
  }
}
