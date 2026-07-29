import type { DashboardSummary, OverallStatus } from '@/lib/dashboard/summary'
import { SEVERITY_ORDER, SEVERITY_LABEL, daysSince, formatRunway } from '@/lib/dashboard/format'

const STATUS_LABEL: Record<OverallStatus, string> = {
  healthy: 'Healthy',
  needs_attention: 'Needs attention',
  critical: 'Critical',
}

// Plain-text/markdown rendering of a DashboardSummary, suitable for pasting
// into an email or Slack message. Mirrors what DashboardSummary renders on
// screen (app/dashboard/_components/dashboard-summary.tsx) — same status
// label, severity breakdown, and urgent-indicator copy.
export function buildDashboardSummaryText(summary: DashboardSummary): string {
  const lines: string[] = []

  lines.push(`**Beacon status summary** — ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}`)
  lines.push('')
  lines.push(`Overall status: ${STATUS_LABEL[summary.overallStatus]}`)

  const total = SEVERITY_ORDER.reduce((sum, severity) => sum + summary.riskFlagCounts[severity], 0)
  const breakdown = SEVERITY_ORDER.map(
    (severity) => `${SEVERITY_LABEL[severity]} ${summary.riskFlagCounts[severity]}`,
  ).join(', ')
  lines.push(`Open risk flags: ${total} (${breakdown})`)

  const days = daysSince(summary.lastActivityAt)
  const activityLabel = summary.lastActivityLabel === 'sync' ? 'sync' : 'check-in'
  lines.push(`Days since last ${activityLabel}: ${days === null ? 'Never' : days}`)

  if (summary.urgentIndicator) {
    const message =
      summary.urgentIndicator.kind === 'cash_runway_critical'
        ? `${summary.urgentIndicator.title} — ${formatRunway(summary.urgentIndicator.runwayMonths)} at the current burn rate.`
        : days === null
          ? 'No check-in has been submitted yet.'
          : `It's been ${days} day${days === 1 ? '' : 's'} since the last check-in.`
    lines.push('')
    lines.push(`⚠ ${message}`)
  }

  return lines.join('\n')
}
