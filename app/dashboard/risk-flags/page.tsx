import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import type { RiskFlag, RiskSeverity } from '@/lib/supabase/types'

// Two-tier visual treatment over the four-value severity column: critical/high
// read as "urgent" (red, warning icon), medium/low as "informational" (blue,
// info icon). Same split as the insurance analyzer's flag list.
const URGENT_SEVERITIES: RiskSeverity[] = ['critical', 'high']
const SEVERITY_RANK: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

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

function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  const urgent = URGENT_SEVERITIES.includes(severity)
  return (
    <span
      className={
        urgent
          ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400'
          : 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400'
      }
    >
      {urgent ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2 20h20L12 3z" />
          <path strokeLinecap="round" d="M12 9.5v4" />
          <circle cx="12" cy="16.75" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 11v5" />
          <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      )}
      {severity[0].toUpperCase() + severity.slice(1)}
    </span>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{currencyFormatter.format(value)}</p>
    </div>
  )
}

function EmptyState({ title, description, cta }: { title: string; description: string; cta?: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
      <p className="text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">{description}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}

function RiskFlagCard({ flag }: { flag: RiskFlag }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-medium">{flag.title}</h3>
        <SeverityBadge severity={flag.severity} />
      </div>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{flag.explanation}</p>
      <div className="mt-4 rounded-md bg-neutral-50 px-4 py-3 dark:bg-neutral-800/50">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Recommendation</p>
        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{flag.recommendation}</p>
      </div>
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

  const sortedFlags = [...(flags ?? [])].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )

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

          {sortedFlags.length === 0 ? (
            <EmptyState
              title="No risk flags for this period."
              description="Nothing crossed a risk threshold in your latest synced financials."
            />
          ) : (
            <div className="space-y-4">
              {sortedFlags.map((flag) => (
                <RiskFlagCard key={flag.id} flag={flag} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
