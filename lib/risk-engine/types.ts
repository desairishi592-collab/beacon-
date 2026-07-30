import type { RiskSeverity, RiskSignalType } from '@/lib/supabase/types'

// A flagged risk signal, computed directly from normalized shift data.
// Matches the risk_flags table shape minus the upload/profile identifiers,
// which the caller already has. Unlike the old finance engine, there's no
// separate LLM explanation step — title/explanation/recommendation are
// generated directly from the signal since these are template-shaped,
// deterministic observations about a schedule, not something that benefits
// from a model's judgment.
export type RiskSignal = {
  type: RiskSignalType
  severity: RiskSeverity
  metricValue: number
  thresholdValue: number | null
  metricLabel: string
  title: string
  explanation: string
  recommendation: string
  context: Record<string, unknown>
}
