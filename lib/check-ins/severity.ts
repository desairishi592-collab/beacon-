// Same threshold as notifySevereCheckin (lib/notifications/check-in-email.ts)
// so a check-in reads as "severe" here exactly when it would have triggered
// an alert email.
export const SEVERE_RATING_THRESHOLD = 4
export const MODERATE_RATING_THRESHOLD = 3

export type SeverityBand = 'severe' | 'moderate' | 'low'

export function overallSeverity(responses: Record<string, number>): number {
  const values = Object.values(responses)
  return values.length > 0 ? Math.max(...values) : 0
}

export function severityBand(rating: number): SeverityBand {
  if (rating >= SEVERE_RATING_THRESHOLD) return 'severe'
  if (rating >= MODERATE_RATING_THRESHOLD) return 'moderate'
  return 'low'
}
