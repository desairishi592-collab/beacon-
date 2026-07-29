import Link from 'next/link'
import type { CurrentSession } from '@/lib/current-user'
import { CheckInHistory, CheckInHistoryLink } from './check-in-history'

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

// Renders the check-in history section for manual-checkin-track users. Runs
// inside a Suspense boundary from app/dashboard/page.tsx, mirroring
// FinancialOverview for the QuickBooks track.
export async function CheckInOverview({
  session,
  hasProfile,
}: {
  session: CurrentSession | null
  hasProfile: boolean
}) {
  if (!session || !hasProfile) {
    return <EmptyStateCard />
  }

  const { data: checkins } = await session.db
    .from('manual_checkins')
    .select('*')
    .eq('profile_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!checkins || checkins.length === 0) {
    return <EmptyStateCard />
  }

  return (
    <>
      <CheckInHistoryLink />
      <CheckInHistory checkins={checkins} />
    </>
  )
}
