import type { DashboardSummary, OverallStatus } from '@/lib/dashboard/summary'
import { daysSince } from '@/lib/dashboard/format'

const STATUS_LABEL: Record<OverallStatus, string> = {
  healthy: 'Healthy',
  needs_attention: 'Needs attention',
}

// Plain-text/markdown rendering of a DashboardSummary, suitable for pasting
// into an email or Slack message. Mirrors what DashboardSummary renders on
// screen (app/dashboard/_components/dashboard-summary.tsx) — same status
// label and overdue-check-in copy.
export function buildDashboardSummaryText(summary: DashboardSummary): string {
  const lines: string[] = []

  lines.push(`**Beacon status summary** — ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}`)
  lines.push('')
  lines.push(`Overall status: ${STATUS_LABEL[summary.overallStatus]}`)

  const days = daysSince(summary.lastActivityAt)
  lines.push(`Days since last check-in: ${days === null ? 'Never' : days}`)

  if (summary.isCheckInOverdue) {
    const message =
      days === null
        ? 'No check-in has been submitted yet.'
        : `It's been ${days} day${days === 1 ? '' : 's'} since the last check-in.`
    lines.push('')
    lines.push(`⚠ ${message}`)
  }

  return lines.join('\n')
}
