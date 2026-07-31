import Link from 'next/link'
import type { CurrentSession } from '@/lib/current-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { FinancialTrends } from './financial-trends'

function EmptyStateCard({
  title,
  description,
  linkHref,
  linkLabel,
}: {
  title: string
  description: string
  linkHref?: string
  linkLabel?: string
}) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
      <p className="text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">{description}</p>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="mt-4 inline-block rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

function NoIntegrationsCard() {
  return (
    <EmptyStateCard
      title="No integrations connected yet."
      description="Connect your financial data to start monitoring risk flags."
      linkHref="/dashboard/settings/integrations"
      linkLabel="Go to integrations"
    />
  )
}

function NotSyncedYetCard() {
  return (
    <EmptyStateCard
      title="Your financial data is connected, but hasn't synced yet."
      description="Once the first sync finishes, your financial trends will show up here."
      linkHref="/dashboard/settings/integrations"
      linkLabel="View sync status"
    />
  )
}

function GatheringDataCard() {
  return (
    <EmptyStateCard
      title="Still gathering data."
      description="We've synced your first month of financials. Once a second month syncs, you'll see revenue, expense, and income trends here."
    />
  )
}

// Renders the financial trends section for finance-track users. Runs inside
// a Suspense boundary from app/dashboard/page.tsx, so it's safe to await
// data here without blocking the rest of the page.
export async function FinancialOverview({
  session,
  hasProfile,
}: {
  session: CurrentSession | null
  hasProfile: boolean
}) {
  if (!session || !hasProfile) {
    return <NoIntegrationsCard />
  }

  // quickbooks_connections has no user-facing select policy (it holds
  // bearer tokens) — read connection status through the service role and
  // only surface the non-sensitive columns, matching the pattern used in
  // app/dashboard/settings/integrations/page.tsx.
  const db = createAdminClient()
  const { data: connection } = await db
    .from('quickbooks_connections')
    .select('last_synced_at')
    .eq('profile_id', session.userId)
    .maybeSingle()

  if (!connection) {
    return <NoIntegrationsCard />
  }

  const { data: snapshots } = await session.db
    .from('financial_snapshots')
    .select('*')
    .eq('profile_id', session.userId)
    .order('period_end', { ascending: true })
    .limit(12)

  if (!snapshots || snapshots.length === 0) {
    return <NotSyncedYetCard />
  }

  if (snapshots.length < 2) {
    return <GatheringDataCard />
  }

  return <FinancialTrends snapshots={snapshots} />
}
