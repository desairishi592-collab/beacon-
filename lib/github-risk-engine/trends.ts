import type { EngineeringRiskFlag, RiskSeverity } from '@/lib/supabase/types'

const SEVERITY_SCORE: Record<RiskSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 }

// A snapshot with no flags scores 0 ("None") — one point below the lowest
// real severity — so a clean sync reads as strictly better than a low flag,
// not the same as one.
export function overallSnapshotSeverity(flags: EngineeringRiskFlag[]): number {
  if (flags.length === 0) return 0
  return Math.max(...flags.map((f) => SEVERITY_SCORE[f.severity]))
}

export type SeverityTrend = {
  recentAverage: number
  // Recent-window average minus the prior window's — null when there isn't
  // a full prior window yet to compare against. Mirrors
  // lib/check-ins/trends.ts#severityTrend so the two "improving/worsening"
  // indicators behave the same way across the app.
  delta: number | null
}

export function severityTrend(severitiesOldestFirst: number[], windowSize = 3): SeverityTrend {
  const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

  const recent = severitiesOldestFirst.slice(-windowSize)
  const prior = severitiesOldestFirst.slice(-windowSize * 2, -windowSize)

  return {
    recentAverage: recent.length > 0 ? average(recent) : 0,
    delta: prior.length > 0 ? average(recent) - average(prior) : null,
  }
}
