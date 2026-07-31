import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { getCheckInQuestions, isManualCheckinField } from '@/lib/check-ins/questions'
import { CheckInTrends } from '../../_components/check-in-trends'
import { CheckInHistory } from '../../_components/check-in-history'
import { DownloadCheckInReportButton } from '../../_components/download-check-in-report-button'

function EmptyStateCard() {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
      <p className="text-neutral-500 dark:text-neutral-400">No check-ins submitted yet.</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">
        Submit a check-in to start building your history and trends here.
      </p>
      <Link
        href="/dashboard/check-in"
        className="mt-4 inline-block rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
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
        className="mt-4 inline-block rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
      >
        Submit another check-in
      </Link>
    </div>
  )
}

export default async function CheckInHistoryPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile } = await db.from('profiles').select('field').eq('id', userId).maybeSingle()
  if (!profile) redirect('/onboarding')
  // Finance has a real integration (QuickBooks) and its own trends view.
  if (!isManualCheckinField(profile.field)) redirect('/dashboard/settings/integrations')

  const questions = getCheckInQuestions(profile.field)

  const { data: checkins } = await db
    .from('manual_checkins')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: true })
    .limit(200)

  const checkinsOldestFirst = checkins ?? []
  const checkinsNewestFirst = [...checkinsOldestFirst].reverse()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check-in History &amp; Trends</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Past submissions, how your overall severity has moved over time, and which risk areas keep
          coming back.
        </p>
      </div>

      {checkinsOldestFirst.length === 0 ? (
        <EmptyStateCard />
      ) : (
        <>
          {checkinsOldestFirst.length < 2 ? (
            <GatheringDataCard />
          ) : (
            <CheckInTrends checkins={checkinsOldestFirst} questions={questions} />
          )}

          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                All submissions
              </h2>
              <DownloadCheckInReportButton checkins={checkinsNewestFirst} questions={questions} />
            </div>
            <CheckInHistory checkins={checkinsNewestFirst} />
          </div>
        </>
      )}
    </div>
  )
}
