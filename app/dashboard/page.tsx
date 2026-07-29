import Link from 'next/link'
import { getCurrentSession } from '@/lib/current-user'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import { FinancialTrends } from './_components/financial-trends'

export default async function DashboardHomePage() {
  const session = await getCurrentSession()

  const { data: profile } = session
    ? await session.db.from('profiles').select('name, field').eq('id', session.userId).maybeSingle()
    : { data: null }

  const showCheckInPath = profile ? isManualCheckinField(profile.field) : false

  const { data: snapshots } =
    session && profile && !showCheckInPath
      ? await session.db
          .from('financial_snapshots')
          .select('*')
          .eq('profile_id', session.userId)
          .order('period_end', { ascending: true })
          .limit(12)
      : { data: null }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{profile?.name ? `, ${profile.name}` : ''}
      </h1>
      <p className="mt-1 text-neutral-500 dark:text-neutral-400">
        Here&apos;s your risk overview.
      </p>

      {showCheckInPath ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-neutral-500 dark:text-neutral-400">
            No automated integration for your field yet.
          </p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">
            In the meantime, use the manual check-in to keep a lightweight risk signal flowing.
          </p>
          <Link
            href="/dashboard/check-in"
            className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Go to check-in
          </Link>
        </div>
      ) : snapshots && snapshots.length > 0 ? (
        <FinancialTrends snapshots={snapshots} />
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-neutral-500 dark:text-neutral-400">No integrations connected yet.</p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">
            Connect QuickBooks to start monitoring risk flags.
          </p>
          <Link
            href="/dashboard/integrations"
            className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Go to integrations
          </Link>
        </div>
      )}
    </div>
  )
}
