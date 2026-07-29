import type { ManualCheckin } from '@/lib/supabase/types'
import type { CheckInQuestion } from '@/lib/check-ins/questions'
import { RATING_SCALE } from '@/lib/check-ins/questions'
import { overallSeverity } from '@/lib/check-ins/severity'

const RATING_LABEL = new Map<number, string>(RATING_SCALE.map((r) => [r.value, r.label]))

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function formatDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// One row per submission — date, overall severity, then one column per
// question — mirroring what CheckInHistory renders for each CheckInCard.
export function buildCheckInHistoryCsv(checkins: ManualCheckin[], questions: CheckInQuestion[]): string {
  const header = ['Date', 'Severity', ...questions.map((q) => q.prompt)]
  const rows = checkins.map((checkin) => {
    const rating = overallSeverity(checkin.responses)
    const answers = questions.map((q) => {
      const value = checkin.responses[q.id]
      return value === undefined ? '' : (RATING_LABEL.get(value) ?? String(value))
    })
    return [formatDate(checkin.created_at), RATING_LABEL.get(rating) ?? String(rating), ...answers]
  })

  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n')
}
