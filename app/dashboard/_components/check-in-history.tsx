import type { ManualCheckin } from '@/lib/supabase/types'
import { getCheckInQuestions, RATING_SCALE, type ManualCheckinField } from '@/lib/check-ins/questions'
import { MODERATE_RATING_THRESHOLD, overallSeverity, SEVERE_RATING_THRESHOLD } from '@/lib/check-ins/severity'

const RATING_LABEL = new Map<number, string>(RATING_SCALE.map((r) => [r.value, r.label]))

function SeverityBadge({ rating }: { rating: number }) {
  const className =
    rating >= SEVERE_RATING_THRESHOLD
      ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
      : rating >= MODERATE_RATING_THRESHOLD
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
        : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {RATING_LABEL.get(rating) ?? rating}
    </span>
  )
}

function CheckInCard({ checkin }: { checkin: ManualCheckin }) {
  const questions = getCheckInQuestions(checkin.field as ManualCheckinField)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {new Date(checkin.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <SeverityBadge rating={overallSeverity(checkin.responses)} />
      </div>

      <dl className="mt-4 space-y-2">
        {questions.map((question) => {
          const value = checkin.responses[question.id]
          if (value === undefined) return null
          return (
            <div key={question.id} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-neutral-600 dark:text-neutral-300">{question.prompt}</dt>
              <dd className="shrink-0 font-medium text-neutral-900 dark:text-neutral-100">
                {RATING_LABEL.get(value) ?? value}
              </dd>
            </div>
          )
        })}
      </dl>

      {checkin.notes && (
        <p className="mt-4 border-t border-neutral-100 pt-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
          {checkin.notes}
        </p>
      )}
    </div>
  )
}

// Simple, most-recent-first list of past manual check-ins — the check-in
// track's equivalent of FinancialTrends for the QuickBooks track.
export function CheckInHistory({ checkins }: { checkins: ManualCheckin[] }) {
  return (
    <div className="mt-6 space-y-4">
      {checkins.map((checkin) => (
        <CheckInCard key={checkin.id} checkin={checkin} />
      ))}
    </div>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

export function CheckInHistorySkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-5 w-16" />
          </div>
          <div className="mt-4 space-y-2">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
