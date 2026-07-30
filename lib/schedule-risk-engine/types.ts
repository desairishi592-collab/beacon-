import type { RiskSeverity, ScheduleRiskSignalType } from '@/lib/supabase/types'

// A flagged risk signal, computed directly from normalized shift data.
// Matches the schedule_risk_flags table shape minus the upload/profile
// identifiers, which the caller already has. title/explanation are
// template-shaped, deterministic observations about the schedule data
// itself, not something that benefits from a model's judgment — but the
// recommendation set here is only a placeholder: analyze.ts calls
// explainScheduleRecommendations (see ./explain.ts) to overwrite it with an
// AI-generated, situation-specific fix before persisting.
export type RiskSignal = {
  type: ScheduleRiskSignalType
  severity: RiskSeverity
  metricValue: number
  thresholdValue: number | null
  metricLabel: string
  title: string
  explanation: string
  recommendation: string
  context: Record<string, unknown>
}
