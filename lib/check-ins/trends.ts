import type { ManualCheckin } from '@/lib/supabase/types'
import type { CheckInQuestion } from './questions'
import { MODERATE_RATING_THRESHOLD, overallSeverity } from './severity'

export type RecurringRiskArea = {
  questionId: string
  prompt: string
  flaggedCount: number
  totalCount: number
}

// Ranks each question by how often it was rated moderate-or-worse across all
// check-ins, so the top entry is the risk area that keeps coming up — not
// just whatever was flagged in the latest submission.
export function recurringRiskAreas(
  checkins: ManualCheckin[],
  questions: CheckInQuestion[],
): RecurringRiskArea[] {
  return questions
    .map((question) => {
      const answered = checkins.filter((c) => c.responses[question.id] !== undefined)
      const flagged = answered.filter((c) => c.responses[question.id] >= MODERATE_RATING_THRESHOLD)
      return {
        questionId: question.id,
        prompt: question.prompt,
        flaggedCount: flagged.length,
        totalCount: answered.length,
      }
    })
    .filter((area) => area.flaggedCount > 0)
    .sort((a, b) => b.flaggedCount - a.flaggedCount)
}

export type SeverityTrend = {
  recentAverage: number
  // Recent-window average minus the prior window's — null when there isn't
  // a full prior window yet to compare against.
  delta: number | null
}

// Compares the average overall severity of the most recent `windowSize`
// check-ins against the `windowSize` before that, so callers can render an
// "improving" / "worsening" indicator instead of just the latest data point.
export function severityTrend(checkinsOldestFirst: ManualCheckin[], windowSize = 3): SeverityTrend {
  const severities = checkinsOldestFirst.map((c) => overallSeverity(c.responses))
  const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

  const recent = severities.slice(-windowSize)
  const prior = severities.slice(-windowSize * 2, -windowSize)

  return {
    recentAverage: recent.length > 0 ? average(recent) : 0,
    delta: prior.length > 0 ? average(recent) - average(prior) : null,
  }
}
