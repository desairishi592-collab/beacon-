import type { CurrentSession } from '@/lib/current-user'
import { getDashboardSummary, type OverallStatus, type RiskFlagCounts } from '@/lib/dashboard/summary'
import type { RiskSeverity } from '@/lib/supabase/types'

const SEVERITY_ORDER: RiskSeverity[] = ['critical', 'high', 'medium', 'low']

const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

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

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null
  const ms = Date.now() - new Date(isoDate).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
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
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <OverallStatusTile status={summary.overallStatus} />
      <RiskFlagCountsTile counts={summary.riskFlagCounts} />
      <LastActivityTile
        lastActivityAt={summary.lastActivityAt}
        lastActivityLabel={summary.lastActivityLabel}
      />
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
