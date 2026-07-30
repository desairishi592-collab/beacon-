import { Suspense } from 'react'
import Link from 'next/link'
import { getCurrentSession } from '@/lib/current-user'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import { DashboardSummary, DashboardSummarySkeleton } from './_components/dashboard-summary'
import { FinancialOverview } from './_components/financial-overview'
import { FinancialTrendsSkeleton } from './_components/financial-trends'
import { CheckInOverview } from './_components/check-in-overview'
import { CheckInHistorySkeleton } from './_components/check-in-history'

export default async function DashboardHomePage() {
  const session = await getCurrentSession()

  const { data: profile } = session
    ? await session.db.from('profiles').select('name, field').eq('id', session.userId).maybeSingle()
    : { data: null }

  const showCheckInPath = profile ? isManualCheckinField(profile.field) : false

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{profile?.name ? `, ${profile.name}` : ''}
      </h1>
      <p className="mt-1 text-neutral-500 dark:text-neutral-400">
        Here&apos;s your risk overview.
      </p>

      <Suspense fallback={<DashboardSummarySkeleton />}>
        <DashboardSummary session={session} isFinance={!showCheckInPath} />
      </Suspense>

      {showCheckInPath ? (
        <>
          <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Upload a staffing schedule to get real risk flags — understaffing, rest violations,
              key-person dependencies, and coverage gaps — instead of relying on manual check-ins alone.
            </p>
            <div className="mt-3 flex gap-4 text-sm font-medium">
              <Link href="/dashboard/settings/integrations" className="text-neutral-900 hover:underline dark:text-neutral-100">
                Upload a schedule →
              </Link>
              <Link href="/dashboard/risk-flags" className="text-neutral-900 hover:underline dark:text-neutral-100">
                View risk flags →
              </Link>
            </div>
          </div>

          <Suspense fallback={<CheckInHistorySkeleton />}>
            <CheckInOverview session={session} hasProfile={!!profile} field={profile?.field} />
          </Suspense>
        </>
      ) : (
        <Suspense fallback={<FinancialTrendsSkeleton />}>
          <FinancialOverview session={session} hasProfile={!!profile} />
        </Suspense>
      )}
    </div>
  )
}
