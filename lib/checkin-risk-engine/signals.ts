import type { CheckInQuestion } from '@/lib/check-ins/questions'
import { MODERATE_RATING_THRESHOLD, SEVERE_RATING_THRESHOLD } from '@/lib/check-ins/severity'
import type { CheckinRiskSignal } from './types'

const RATING_LABELS: Record<number, string> = {
  3: 'Moderate',
  4: 'Significant',
  5: 'Severe',
}

function severityForRating(rating: number): CheckinRiskSignal['severity'] | null {
  if (rating >= 5) return 'critical'
  if (rating >= SEVERE_RATING_THRESHOLD) return 'high'
  if (rating >= MODERATE_RATING_THRESHOLD) return 'medium'
  return null
}

// Computes every flagged risk signal for one manual check-in submission:
// any question rated moderate concern (3) or worse becomes a signal. Unlike
// the schedule engine's rule-based checks, there's no numeric baseline to
// compare against here — the manager's own rating *is* the signal.
// recommendation is a placeholder overwritten by explainCheckinSignals (see
// ./explain.ts) before persisting.
export function computeCheckinRiskSignals(
  responses: Record<string, number>,
  questions: CheckInQuestion[]
): CheckinRiskSignal[] {
  const signals: CheckinRiskSignal[] = []

  for (const question of questions) {
    const rating = responses[question.id]
    if (rating === undefined) continue

    const severity = severityForRating(rating)
    if (!severity) continue

    signals.push({
      type: 'checkin_concern',
      severity,
      metricValue: rating,
      thresholdValue: MODERATE_RATING_THRESHOLD,
      metricLabel: `checkin_concern:${question.id}`,
      title: `Elevated concern: ${question.prompt.replace(/\?$/, '')}`,
      explanation: `Rated "${RATING_LABELS[rating] ?? rating}" (${rating}/5) on this check-in.`,
      recommendation: 'Discuss this concern with your team and agree on a next step to address it.',
      context: { questionId: question.id, prompt: question.prompt, rating },
    })
  }

  return signals
}
