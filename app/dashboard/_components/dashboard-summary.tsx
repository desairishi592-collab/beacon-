import type { CurrentSession } from '@/lib/current-user'
import { getDashboardSummary, type OverallStatus } from '@/lib/dashboard/summary'
import { daysSince } from '@/lib/dashboard/format'
import { CopySummaryButton } from './copy-summary-button'

const STATUS_COPY: Record<OverallStatus, { label: string; className: string }> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  },
  needs_attention: {
    label: 'Needs attention',
    className: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
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

function UrgentBanner({ lastActivityAt }: { lastActivityAt: string | null }) {
  const days = daysSince(lastActivityAt)
  const message =
    days === null
      ? 'No check-in has been submitted yet.'
      : `It's been ${days} day${days === 1 ? '' : 's'} since the last check-in.`

  return (
    <div
      role="alert"
      className="mb-3 rounded-lg border border-red-100 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/40"
    >
      <p className="text-sm font-semibold text-red-600 dark:text-red-400">Check-in overdue</p>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>
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

function LastActivityTile({ lastActivityAt }: { lastActivityAt: string | null }) {
  const days = daysSince(lastActivityAt)
  return (
    <SummaryTile label="Days since last check-in">
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

// At-a-glance summary shown above the check-in dashboard content
// (CheckInOverview) — read-only over check-in data.
export async function DashboardSummary({ session }: { session: CurrentSession | null }) {
  if (!session) return null

  const summary = await getDashboardSummary(session)

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-end">
        <CopySummaryButton summary={summary} />
      </div>
      {summary.isCheckInOverdue && <UrgentBanner lastActivityAt={summary.lastActivityAt} />}
      <div className="grid grid-cols-2 gap-3">
        <OverallStatusTile status={summary.overallStatus} />
        <LastActivityTile lastActivityAt={summary.lastActivityAt} />
      </div>
    </div>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

export function DashboardSummarySkeleton() {
  return (
    <div className="mt-6 grid animate-pulse grid-cols-2 gap-3" aria-hidden="true">
      {[0, 1].map((i) => (
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
