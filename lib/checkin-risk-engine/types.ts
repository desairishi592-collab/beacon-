import type { ManualCheckinRiskSignalType, RiskSeverity } from '@/lib/supabase/types'

// A flagged risk signal, computed from a single manual check-in
// submission's responses. Matches the manual_checkin_risk_flags table shape
// minus the checkin/profile identifiers, which the caller already has.
export type CheckinRiskSignal = {
  type: ManualCheckinRiskSignalType
  severity: RiskSeverity
  metricValue: number
  thresholdValue: number | null
  metricLabel: string
  title: string
  explanation: string
  recommendation: string
  context: Record<string, unknown>
}
