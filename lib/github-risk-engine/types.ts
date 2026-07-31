import type { EngineeringRiskSignalType, EngineeringSnapshot, RiskSeverity } from '@/lib/supabase/types'

// A flagged risk signal, computed from an engineering_snapshots row (and
// usually its prior sync) before it has been explained by the LLM. Only
// signals that cross a threshold are produced — see ./signals.ts.
export type RiskSignal = {
  type: EngineeringRiskSignalType
  severity: RiskSeverity
  /** The computed value that crossed the threshold (e.g. oldest PR age in days, commit-count drop as a fraction). */
  metricValue: number
  thresholdValue: number | null
  /** Short machine-readable identifier, e.g. "stale_pull_requests:oldest_age". */
  metricLabel: string
  /** Additional numbers/strings describing the signal, passed to the LLM as context. */
  context: Record<string, number | string>
}

// A risk signal after the LLM has translated it into plain language.
export type ExplainedRiskSignal = RiskSignal & {
  title: string
  explanation: string
  recommendation: string
}

export type SnapshotPair = {
  current: EngineeringSnapshot
  /** The most recent snapshot for the same profile with an earlier synced_at, if any. */
  prior: EngineeringSnapshot | null
}
