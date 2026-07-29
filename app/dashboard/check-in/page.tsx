import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { getCheckInQuestions, isManualCheckinField, RATING_SCALE } from '@/lib/check-ins/questions'
import { CheckInForm } from './check-in-form'

const RATING_LABEL = new Map<number, string>(RATING_SCALE.map((r) => [r.value, r.label]))

export default async function CheckInPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile } = await db.from('profiles').select('field').eq('id', userId).maybeSingle()
  if (!profile) redirect('/onboarding')
  // Finance has a real integration (QuickBooks) — send them there instead.
  if (!isManualCheckinField(profile.field)) redirect('/dashboard/integrations')

  const questions = getCheckInQuestions(profile.field)

  const { data: history } = await db
    .from('manual_checkins')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check-in</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          A few quick risk-relevant questions for your field.
        </p>
      </div>

      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
        Beacon doesn&apos;t have an automated integration for your field yet. This manual check-in
        is a lightweight interim substitute — answer it periodically (e.g. weekly) so there&apos;s
        still a signal to look at until we build a real integration.
      </p>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <CheckInForm questions={questions} />
      </div>

      {history && history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Past check-ins
          </h2>
          {history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <p className="text-xs text-neutral-400 dark:text-neutral-600">
                {new Date(entry.created_at).toLocaleString()}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {questions.map((question) => {
                  const value = entry.responses[question.id]
                  if (value === undefined) return null
                  return (
                    <span
                      key={question.id}
                      className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                    >
                      {question.prompt.replace(/\?$/, '')}: {RATING_LABEL.get(value) ?? value}
                    </span>
                  )
                })}
              </div>
              {entry.notes && (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-400 dark:text-neutral-600">
        Looking for automated monitoring? Check{' '}
        <Link href="/dashboard/integrations" className="underline">
          Integrations
        </Link>{' '}
        — QuickBooks is supported today, with more integrations planned by field.
      </p>
    </div>
  )
}
