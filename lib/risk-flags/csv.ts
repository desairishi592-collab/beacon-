import type { RiskFlag } from '@/lib/supabase/types'
import { SIGNAL_TYPE_LABELS } from '@/lib/notifications/channels'

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function formatDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatSeverity(severity: RiskFlag['severity']): string {
  return severity[0].toUpperCase() + severity.slice(1)
}

// One row per flag — date, severity, signal type, and description — mirroring
// the check-in history and financial snapshot CSV exports.
export function buildRiskFlagsCsv(flags: RiskFlag[]): string {
  const header = ['Date', 'Severity', 'Signal Type', 'Description']
  const rows = flags.map((flag) => [
    formatDate(flag.created_at),
    formatSeverity(flag.severity),
    SIGNAL_TYPE_LABELS[flag.signal_type],
    flag.explanation,
  ])

  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n')
}
