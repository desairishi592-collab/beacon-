import type { CurrentSession } from '@/lib/current-user'
import {
  getDashboardSummary,
  type OverallStatus,
  type RiskFlagCounts,
  type UrgentIndicator,
} from '@/lib/dashboard/summary'
import { SEVERITY_ORDER, SEVERITY_LABEL, daysSince, formatRunway } from '@/lib/dashboard/format'
import { CopySummaryButton } from './copy-summary-button'
import type { RiskSeverity } from '@/lib/supabase/types'

// Same red/blue urgent-vs-informational split as the risk flags list
// (app/dashboard/risk-flags/risk-flags-list.tsx), plus amber/neutral for the
// two severities that don't carry that urgent treatment there.
const SEVERITY_CLASSES: Record<RiskSeverity, string> = {
  critical: 'text-red-700 dark:text-red-400',
  high: 'text-red-700 dark:text-red-400',
  medium: 'text-amber-700 dark:text-amber-400',
  low: 'text-neutral-700 dark:text-neutral-300',
}

const STATUS_COPY: Record<OverallStatus, { label: string; className: string }> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
  },
  needs_attention: {
    label: 'Needs attention',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  critical: {
    label: 'Critical',
    className: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  },
}

function StatusBadge({ status }: { status: OverallStatus }) {
  const { label, className } = STATUS_COPY[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

// Red for cash runway critical (matches the "critical" severity treatment
// elsewhere on the dashboard), amber for check-in overdue (a softer,
// reminder-level urgency, matching the "needs attention" status color).
const URGENT_CLASSES: Record<UrgentIndicator['kind'], { container: string; title: string; body: string }> = {
  cash_runway_critical: {
    container: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
    title: 'text-red-800 dark:text-red-300',
    body: 'text-red-700 dark:text-red-400',
  },
  check_in_overdue: {
    container: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
    title: 'text-amber-800 dark:text-amber-300',
    body: 'text-amber-700 dark:text-amber-400',
  },
}

const URGENT_LABEL: Record<UrgentIndicator['kind'], string> = {
  cash_runway_critical: 'Cash runway critical',
  check_in_overdue: 'Check-in overdue',
}

function UrgentBanner({
  indicator,
  lastActivityAt,
}: {
  indicator: UrgentIndicator
  lastActivityAt: string | null
}) {
  const classes = URGENT_CLASSES[indicator.kind]

  const message =
    indicator.kind === 'cash_runway_critical'
      ? `${indicator.title} — ${formatRunway(indicator.runwayMonths)} at the current burn rate.`
      : (() => {
          const days = daysSince(lastActivityAt)
          return days === null
            ? "No check-in has been submitted yet."
            : `It's been ${days} day${days === 1 ? '' : 's'} since the last check-in.`
        })()

  return (
    <div role="alert" className={`mb-3 rounded-lg border p-4 ${classes.container}`}>
      <p className={`text-sm font-semibold ${classes.title}`}>{URGENT_LABEL[indicator.kind]}</p>
      <p className={`mt-1 text-sm ${classes.body}`}>{message}</p>
    </div>
  )
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function RiskFlagCountsTile({ counts }: { counts: RiskFlagCounts }) {
  const total = SEVERITY_ORDER.reduce((sum, severity) => sum + counts[severity], 0)

  return (
    <SummaryTile label="Open risk flags">
      <p className="text-xl font-semibold tracking-tight">{total}</p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {SEVERITY_ORDER.map((severity) => (
          <li key={severity} className={`text-xs font-medium ${SEVERITY_CLASSES[severity]}`}>
            {SEVERITY_LABEL[severity]} {counts[severity]}
          </li>
        ))}
      </ul>
    </SummaryTile>
  )
}

function LastActivityTile({
  lastActivityAt,
  lastActivityLabel,
}: {
  lastActivityAt: string | null
  lastActivityLabel: 'sync' | 'check-in'
}) {
  const days = daysSince(lastActivityAt)
  return (
    <SummaryTile label={`Days since last ${lastActivityLabel}`}>
      <p className="text-xl font-semibold tracking-tight">{days === null ? 'Never' : days}</p>
    </SummaryTile>
  )
}

function OverallStatusTile({ status }: { status: OverallStatus }) {
  return (
    <SummaryTile label="Overall status">
      <StatusBadge status={status} />
    </SummaryTile>
  )
}

// At-a-glance summary shown above the field-specific dashboard content
// (FinancialOverview or CheckInOverview) — read-only over risk flags,
// check-ins, and QuickBooks sync data, regardless of the user's field.
export async function DashboardSummary({
  session,
  isFinance,
}: {
  session: CurrentSession | null
  isFinance: boolean
}) {
  if (!session) return null

  const summary = await getDashboardSummary(session, isFinance)

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-end">
        <CopySummaryButton summary={summary} />
      </div>
      {summary.urgentIndicator && (
        <UrgentBanner indicator={summary.urgentIndicator} lastActivityAt={summary.lastActivityAt} />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <OverallStatusTile status={summary.overallStatus} />
        <RiskFlagCountsTile counts={summary.riskFlagCounts} />
        <LastActivityTile
          lastActivityAt={summary.lastActivityAt}
          lastActivityLabel={summary.lastActivityLabel}
        />
      </div>
    </div>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

export function DashboardSummarySkeleton() {
  return (
    <div className="mt-6 grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-2 h-6 w-16" />
        </div>
      ))}
    </div>
  )
}
