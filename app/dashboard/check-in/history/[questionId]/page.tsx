import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { getCheckInQuestions, isManualCheckinField } from '@/lib/check-ins/questions'
import { SEVERE_RATING_THRESHOLD } from '@/lib/check-ins/severity'
import { SeverityBadge } from '../../../_components/check-in-history'

export default async function RecurringRiskAreaPage({
  params,
}: {
  params: Promise<{ questionId: string }>
}) {
  const { questionId } = await params

  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile } = await db.from('profiles').select('field').eq('id', userId).maybeSingle()
  if (!profile) redirect('/onboarding')
  // Finance has a real integration (QuickBooks) and its own trends view.
  if (!isManualCheckinField(profile.field)) redirect('/dashboard/integrations')

  const question = getCheckInQuestions(profile.field).find((q) => q.id === questionId)
  if (!question) notFound()

  const { data: checkins } = await db
    .from('manual_checkins')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)

  const flagged = (checkins ?? []).filter(
    (c) => (c.responses[question.id] ?? 0) >= SEVERE_RATING_THRESHOLD,
  )

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/check-in/history"
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          &larr; Back to history &amp; trends
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{question.prompt}</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          {flagged.length} {flagged.length === 1 ? 'submission has' : 'submissions have'} flagged this
          as a high-severity concern, most recent first.
        </p>
      </div>

      {flagged.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-neutral-500 dark:text-neutral-400">
            No submissions currently rate this question as high severity.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {flagged.map((checkin) => (
            <div
              key={checkin.id}
              className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {new Date(checkin.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <SeverityBadge rating={checkin.responses[question.id]} />
              </div>
              {checkin.notes && (
                <p className="mt-4 border-t border-neutral-100 pt-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                  {checkin.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
