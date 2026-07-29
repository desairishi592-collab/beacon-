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

function monthKey(createdAt: string) {
  const d = new Date(createdAt)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export type NewRiskArea = {
  questionId: string
  prompt: string
}

export type PeriodComparison = {
  currentLabel: string
  priorLabel: string
  currentAverage: number
  priorAverage: number
  delta: number
  trend: 'up' | 'down' | 'flat'
  // Questions flagged moderate-or-worse at least once this period that
  // weren't flagged at all in the prior period.
  newRiskAreas: NewRiskArea[]
}

// Compares the most recent calendar month with check-ins against the one
// before it (by calendar month, not just the prior N submissions), so
// callers can render a "this month vs last month" style indicator. Returns
// null until check-ins span at least two distinct calendar months.
export function monthOverMonthComparison(
  checkinsOldestFirst: ManualCheckin[],
  questions: CheckInQuestion[],
): PeriodComparison | null {
  const months = Array.from(new Set(checkinsOldestFirst.map((c) => monthKey(c.created_at)))).sort()
  if (months.length < 2) return null

  const currentMonth = months[months.length - 1]
  const priorMonth = months[months.length - 2]
  const currentCheckins = checkinsOldestFirst.filter((c) => monthKey(c.created_at) === currentMonth)
  const priorCheckins = checkinsOldestFirst.filter((c) => monthKey(c.created_at) === priorMonth)

  const average = (checkins: ManualCheckin[]) =>
    checkins.reduce((sum, c) => sum + overallSeverity(c.responses), 0) / checkins.length

  const currentAverage = average(currentCheckins)
  const priorAverage = average(priorCheckins)
  const delta = currentAverage - priorAverage
  const trend: PeriodComparison['trend'] = Math.abs(delta) < 0.25 ? 'flat' : delta > 0 ? 'up' : 'down'

  const flaggedQuestionIds = (checkins: ManualCheckin[]) =>
    new Set(
      questions
        .filter((q) => checkins.some((c) => (c.responses[q.id] ?? 0) >= MODERATE_RATING_THRESHOLD))
        .map((q) => q.id),
    )
  const currentFlagged = flaggedQuestionIds(currentCheckins)
  const priorFlagged = flaggedQuestionIds(priorCheckins)
  const newRiskAreas = questions
    .filter((q) => currentFlagged.has(q.id) && !priorFlagged.has(q.id))
    .map((q) => ({ questionId: q.id, prompt: q.prompt }))

  return {
    currentLabel: monthLabel(currentCheckins[0].created_at),
    priorLabel: monthLabel(priorCheckins[0].created_at),
    currentAverage,
    priorAverage,
    delta,
    trend,
    newRiskAreas,
  }
}
