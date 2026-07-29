import type { FinancialSnapshot, RiskSeverity, RiskSignalType } from '@/lib/supabase/types'

// A flagged risk signal, computed from a snapshot (and usually its prior
// period) before it has been explained by the LLM. Only signals that cross
// a threshold are produced — see lib/risk-engine/signals.ts.
export type RiskSignal = {
  type: RiskSignalType
  severity: RiskSeverity
  /** The computed value that crossed the threshold (e.g. runway in months, DSCR ratio). */
  metricValue: number
  thresholdValue: number | null
  /** Short machine-readable identifier, e.g. "expense_concentration:payroll". */
  metricLabel: string
  /** Additional numbers describing the signal, passed to the LLM as context. */
  context: Record<string, number | string>
}

// A risk signal after the LLM has translated it into plain language.
// Matches the risk_flags table shape (minus snapshot/profile identifiers,
// which the caller already has).
export type ExplainedRiskSignal = RiskSignal & {
  title: string
  explanation: string
  recommendation: string
}

export type SnapshotPair = {
  current: FinancialSnapshot
  /** The most recent snapshot for the same profile with an earlier period_end, if any. */
  prior: FinancialSnapshot | null
}
