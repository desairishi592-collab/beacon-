import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import type { Database } from '@/lib/supabase/types'
import { EmptyState, RiskFlagsSection } from './risk-flags-list'
import {
  EmptyState as ScheduleEmptyState,
  RiskFlagsSection as ScheduleRiskFlagsSection,
} from './schedule-risk-flags-list'
import {
  EmptyState as CheckInEmptyState,
  RiskFlagsSection as CheckInRiskFlagsSection,
} from './checkin-risk-flags-list'

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

async function ScheduleRiskFlags({ userId, db }: { userId: string; db: SupabaseClient<Database> }) {
  const { data: upload } = await db
    .from('schedule_uploads')
    .select('filename, row_count, needs_mapping, created_at')
    .eq('profile_id', userId)
    .maybeSingle()

  const { data: flags } = upload
    ? await db
        .from('schedule_risk_flags')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })
    : { data: null }

  if (!upload) {
    return (
      <ScheduleEmptyState
        title="Upload a schedule to see your risk flags."
        description="Beacon analyzes an uploaded staffing schedule for understaffing, rest violations, key-person dependencies, and coverage gaps."
        cta={
          <Link
            href="/dashboard/integrations"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Go to Integrations
          </Link>
        }
      />
    )
  }

  if (upload.needs_mapping) {
    return (
      <ScheduleEmptyState
        title="Finish mapping your schedule's columns."
        description={`${upload.filename} was uploaded but needs a few columns confirmed before it can be analyzed.`}
        cta={
          <Link
            href="/dashboard/integrations"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Finish mapping
          </Link>
        }
      />
    )
  }

  return (
    <>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {upload.filename} · {upload.row_count} {upload.row_count === 1 ? 'row' : 'rows'} · uploaded{' '}
        {new Date(upload.created_at).toLocaleString()}
      </p>
      <ScheduleRiskFlagsSection flags={flags ?? []} />
    </>
  )
}

async function CheckInRiskFlags({ userId, db }: { userId: string; db: SupabaseClient<Database> }) {
  const { data: latestCheckin } = await db
    .from('manual_checkins')
    .select('id')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestCheckin) {
    return (
      <CheckInEmptyState
        title="Submit a check-in to see check-in flags."
        description="Beacon analyzes your periodic check-in answers for concerns rated moderate or worse."
        cta={
          <Link
            href="/dashboard/check-in"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Go to check-in
          </Link>
        }
      />
    )
  }

  const { data: flags } = await db
    .from('manual_checkin_risk_flags')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })

  return <CheckInRiskFlagsSection flags={flags ?? []} />
}

async function FinancialRiskFlags({ userId, db }: { userId: string; db: SupabaseClient<Database> }) {
  const { data: snapshot } = await db
    .from('financial_snapshots')
    .select('*')
    .eq('profile_id', userId)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: flags } = snapshot
    ? await db.from('risk_flags').select('*').eq('snapshot_id', snapshot.id)
    : { data: null }

  if (!snapshot) {
    return (
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
    )
  }

  return (
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

      <RiskFlagsSection flags={flags ?? []} />
    </>
  )
}

export default async function RiskFlagsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile } = await db.from('profiles').select('field').eq('id', userId).maybeSingle()
  const showCheckInPath = profile ? isManualCheckinField(profile.field) : true

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Risk Flags</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          {showCheckInPath
            ? 'Staffing and coverage signals from your most recent schedule upload, plus concerns flagged from your check-ins.'
            : 'Signals from your most recent financial snapshot that crossed a risk threshold.'}
        </p>
      </div>

      {showCheckInPath ? (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-medium tracking-tight">Schedule</h2>
            <ScheduleRiskFlags userId={userId} db={db} />
          </section>
          <section>
            <h2 className="text-lg font-medium tracking-tight">Check-ins</h2>
            <CheckInRiskFlags userId={userId} db={db} />
          </section>
        </div>
      ) : (
        <FinancialRiskFlags userId={userId} db={db} />
      )}
    </div>
  )
}
