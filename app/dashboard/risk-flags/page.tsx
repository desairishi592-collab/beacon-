import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import { createAdminClient } from '@/lib/supabase/admin'
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
import {
  EmptyState as EngineeringEmptyState,
  RiskFlagsSection as EngineeringRiskFlagsSection,
} from './engineering-risk-flags-list'
import { EngineeringTrends } from '../_components/engineering-trends'
import type { EngineeringRiskFlag } from '@/lib/supabase/types'

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
            href="/dashboard/settings/integrations"
            className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
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
            href="/dashboard/settings/integrations"
            className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
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

function NumberStatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

async function EngineeringRiskFlags({ userId, db }: { userId: string; db: SupabaseClient<Database> }) {
  // github_connections has no user-facing select policy (it holds a bearer
  // token) — check connection status through the service role, same
  // pattern as app/dashboard/settings/integrations/page.tsx.
  const adminDb = createAdminClient()
  const { data: connection } = await adminDb
    .from('github_connections')
    .select('repo_owner, repo_name')
    .eq('profile_id', userId)
    .maybeSingle()

  if (!connection) {
    return (
      <EngineeringEmptyState
        title="Connect a GitHub repository to see your risk flags."
        description="Beacon analyzes open pull requests, unresolved critical issues, and commit frequency for delivery and stability risk."
        cta={
          <Link
            href="/dashboard/settings/integrations"
            className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
          >
            Go to Integrations
          </Link>
        }
      />
    )
  }

  // Last 30 syncs (oldest first) so the trend view below has history to
  // chart, not just the latest point.
  const { data: snapshots } = await db
    .from('engineering_snapshots')
    .select('*')
    .eq('profile_id', userId)
    .order('synced_at', { ascending: false })
    .limit(30)

  const snapshotsOldestFirst = snapshots ? [...snapshots].reverse() : []
  const snapshot = snapshotsOldestFirst[snapshotsOldestFirst.length - 1]

  if (!snapshot) {
    return (
      <EngineeringEmptyState
        title={`${connection.repo_owner}/${connection.repo_name} is connected, but hasn't synced yet.`}
        description="Once the first sync finishes, your risk flags will show up here."
        cta={
          <Link
            href="/dashboard/settings/integrations"
            className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
          >
            View sync status
          </Link>
        }
      />
    )
  }

  const { data: allFlags } = await db
    .from('engineering_risk_flags')
    .select('*')
    .in(
      'snapshot_id',
      snapshotsOldestFirst.map((s) => s.id),
    )

  const flagsBySnapshot = new Map<string, EngineeringRiskFlag[]>()
  for (const flag of allFlags ?? []) {
    const existing = flagsBySnapshot.get(flag.snapshot_id)
    if (existing) existing.push(flag)
    else flagsBySnapshot.set(flag.snapshot_id, [flag])
  }
  const latestFlags = flagsBySnapshot.get(snapshot.id) ?? []

  return (
    <>
      <div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {connection.repo_owner}/{connection.repo_name} · synced{' '}
          {new Date(snapshot.synced_at).toLocaleString()}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberStatTile label="Open PRs" value={snapshot.open_pr_count} />
          <NumberStatTile label="Critical issues" value={snapshot.open_critical_issue_count} />
          <NumberStatTile label="Commits (30d)" value={snapshot.commits_last_30_days} />
        </div>
      </div>

      {snapshotsOldestFirst.length >= 2 ? (
        <EngineeringTrends snapshots={snapshotsOldestFirst} flagsBySnapshot={flagsBySnapshot} />
      ) : (
        <p className="mt-6 text-sm text-neutral-400 dark:text-neutral-600">
          Trends will show up here once a second sync comes in.
        </p>
      )}

      <EngineeringRiskFlagsSection flags={latestFlags} />
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
            className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
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
        title="Connect your financial data to see your risk flags."
        description="Beacon analyzes your synced financials for cash, burn, coverage, and expense risk."
        cta={
          <Link
            href="/dashboard/settings/integrations"
            className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
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
  const isEngineering = profile?.field === 'engineering'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Risk Flags</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          {isEngineering
            ? 'Delivery and stability signals from your connected GitHub repository, plus concerns flagged from your check-ins.'
            : showCheckInPath
              ? 'Staffing and coverage signals from your most recent schedule upload, plus concerns flagged from your check-ins.'
              : 'Signals from your most recent financial snapshot that crossed a risk threshold.'}
        </p>
      </div>

      {isEngineering ? (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-medium tracking-tight">GitHub</h2>
            <EngineeringRiskFlags userId={userId} db={db} />
          </section>
          <section>
            <h2 className="text-lg font-medium tracking-tight">Check-ins</h2>
            <CheckInRiskFlags userId={userId} db={db} />
          </section>
        </div>
      ) : showCheckInPath ? (
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
