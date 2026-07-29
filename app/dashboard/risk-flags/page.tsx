import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { EmptyState, RiskFlagsList } from './risk-flags-list'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatPeriod(periodStart: string, periodEnd: string) {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  const start = new Date(periodStart).toLocaleDateString('en-US', options)
  const end = new Date(periodEnd).toLocaleDateString('en-US', { ...options, year: 'numeric' })
  return `${start} – ${end}`
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{currencyFormatter.format(value)}</p>
    </div>
  )
}

export default async function RiskFlagsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')

  const { data: snapshot } = await session.db
    .from('financial_snapshots')
    .select('*')
    .eq('profile_id', session.userId)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: flags } = snapshot
    ? await session.db.from('risk_flags').select('*').eq('snapshot_id', snapshot.id)
    : { data: null }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Risk Flags</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Signals from your most recent financial snapshot that crossed a risk threshold.
        </p>
      </div>

      {!snapshot ? (
        <EmptyState
          title="Connect QuickBooks to see your risk flags."
          description="Beacon analyzes your synced financials for cash, burn, coverage, and expense risk."
          cta={
            <Link
              href="/dashboard/integrations"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Go to Integrations
            </Link>
          }
        />
      ) : (
        <>
          <div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Latest snapshot · {formatPeriod(snapshot.period_start, snapshot.period_end)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Cash balance" value={snapshot.cash_balance} />
              <StatTile label="Revenue" value={snapshot.total_revenue} />
              <StatTile label="Expenses" value={snapshot.total_expenses} />
              <StatTile label="Operating income" value={snapshot.operating_income} />
            </div>
          </div>

          <RiskFlagsList flags={flags ?? []} />
        </>
      )}
    </div>
  )
}
