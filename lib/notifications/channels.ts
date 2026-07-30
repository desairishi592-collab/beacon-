import type { RiskSeverity, RiskSignalType } from '@/lib/supabase/types'

// Two-tier split used across the alerts feature: critical/high are "urgent"
// enough to email, medium/low stay dashboard-only regardless of preference.
export const URGENT_SEVERITIES: RiskSeverity[] = ['critical', 'high']

export const SIGNAL_TYPE_LABELS: Record<RiskSignalType, string> = {
  cash_runway: 'Cash runway',
  burn_rate: 'Burn rate',
  dscr: 'Debt service coverage',
  expense_concentration: 'Expense concentration',
  anomaly: 'Anomaly',
}

export const SIGNAL_TYPES = Object.keys(SIGNAL_TYPE_LABELS) as RiskSignalType[]

export type NotificationChannel = 'email_and_in_app' | 'in_app_only'

// A flag only ever reaches email if it's urgent; per-type preferences can
// opt an otherwise-urgent type out of email but never opt a non-urgent one
// in, since low/medium flags are informational by design.
export function resolveChannel(
  severity: RiskSeverity,
  signalType: RiskSignalType,
  emailDisabledTypes: ReadonlySet<RiskSignalType>,
): NotificationChannel {
  if (!URGENT_SEVERITIES.includes(severity)) return 'in_app_only'
  return emailDisabledTypes.has(signalType) ? 'in_app_only' : 'email_and_in_app'
}
