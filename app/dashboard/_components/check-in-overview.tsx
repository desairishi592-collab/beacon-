import Link from 'next/link'
import type { CurrentSession } from '@/lib/current-user'
import type { Field } from '@/lib/supabase/types'
import { getCheckInQuestions, isManualCheckinField } from '@/lib/check-ins/questions'
import { CheckInHistory } from './check-in-history'
import { CheckInTrends } from './check-in-trends'

function EmptyStateCard() {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
      <p className="text-neutral-500 dark:text-neutral-400">No check-ins submitted yet.</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">
        Submit a check-in to start building your history here.
      </p>
      <Link
        href="/dashboard/check-in"
        className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Go to check-in
      </Link>
    </div>
  )
}

function GatheringDataCard() {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
      <p className="text-neutral-500 dark:text-neutral-400">Still gathering data.</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">
        You&apos;ve submitted one check-in. Once a second comes in, you&apos;ll see a severity trend
        and recurring risk areas here.
      </p>
      <Link
        href="/dashboard/check-in"
        className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Submit another check-in
      </Link>
    </div>
  )
}

// Renders the check-in history & trends section for manual-checkin-track
// users, in the same dashboard-home slot FinancialOverview uses for the
// QuickBooks track: a severity trend chart, recurring risk areas, and the
// full submission list. Runs inside a Suspense boundary from
// app/dashboard/page.tsx.
export async function CheckInOverview({
  session,
  hasProfile,
  field,
}: {
  session: CurrentSession | null
  hasProfile: boolean
  field?: Field
}) {
  if (!session || !hasProfile || !field || !isManualCheckinField(field)) {
    return <EmptyStateCard />
  }

  const { data: checkins } = await session.db
    .from('manual_checkins')
    .select('*')
    .eq('profile_id', session.userId)
    .order('created_at', { ascending: true })
    .limit(200)

  const checkinsOldestFirst = checkins ?? []

  if (checkinsOldestFirst.length === 0) {
    return <EmptyStateCard />
  }

  if (checkinsOldestFirst.length < 2) {
    return <GatheringDataCard />
  }

  const questions = getCheckInQuestions(field)

  return (
    <div className="mt-6 space-y-6">
      <CheckInTrends checkins={checkinsOldestFirst} questions={questions} />

      <div>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">All submissions</h2>
        <CheckInHistory checkins={[...checkinsOldestFirst].reverse()} />
      </div>
    </div>
  )
}
