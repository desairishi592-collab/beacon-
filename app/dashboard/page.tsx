import { Suspense } from 'react'
import { getCurrentSession } from '@/lib/current-user'
import { isManualCheckinField } from '@/lib/check-ins/questions'
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

      {showCheckInPath ? (
        <Suspense fallback={<CheckInHistorySkeleton />}>
          <CheckInOverview session={session} hasProfile={!!profile} />
        </Suspense>
      ) : (
        <Suspense fallback={<FinancialTrendsSkeleton />}>
          <FinancialOverview session={session} hasProfile={!!profile} />
        </Suspense>
      )}
    </div>
  )
}
