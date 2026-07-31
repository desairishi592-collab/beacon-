import Link from 'next/link'
import type { CurrentSession } from '@/lib/current-user'
import { createAdminClient } from '@/lib/supabase/admin'

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

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

// Renders a GitHub summary for engineering-track users who've connected a
// repository, in the same dashboard-home slot FinancialOverview uses for
// the QuickBooks track. Runs inside a Suspense boundary from
// app/dashboard/page.tsx, so it's safe to await data here without blocking
// the rest of the page.
export async function EngineeringOverview({
  session,
  hasProfile,
}: {
  session: CurrentSession | null
  hasProfile: boolean
}) {
  if (!session || !hasProfile) {
    return (
      <EmptyStateCard
        title="No GitHub repository connected yet."
        description="Connect a repository to start monitoring engineering risk flags."
        linkHref="/dashboard/settings/integrations"
        linkLabel="Go to integrations"
      />
    )
  }

  // github_connections has no user-facing select policy (it holds a bearer
  // token) — read connection status through the service role, matching
  // app/dashboard/settings/integrations/page.tsx.
  const db = createAdminClient()
  const { data: connection } = await db
    .from('github_connections')
    .select('repo_owner, repo_name')
    .eq('profile_id', session.userId)
    .maybeSingle()

  if (!connection) {
    return (
      <EmptyStateCard
        title="No GitHub repository connected yet."
        description="Connect a repository to start monitoring engineering risk flags."
        linkHref="/dashboard/settings/integrations"
        linkLabel="Go to integrations"
      />
    )
  }

  const { data: snapshot } = await session.db
    .from('engineering_snapshots')
    .select('*')
    .eq('profile_id', session.userId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!snapshot) {
    return (
      <EmptyStateCard
        title={`${connection.repo_owner}/${connection.repo_name} is connected, but hasn't synced yet.`}
        description="Once the first sync finishes, your engineering summary will show up here."
        linkHref="/dashboard/settings/integrations"
        linkLabel="View sync status"
      />
    )
  }

  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {connection.repo_owner}/{connection.repo_name} · synced{' '}
        {new Date(snapshot.synced_at).toLocaleString()}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Open PRs" value={snapshot.open_pr_count} />
        <StatTile label="Critical issues" value={snapshot.open_critical_issue_count} />
        <StatTile label="Commits (30d)" value={snapshot.commits_last_30_days} />
      </div>
      <Link
        href="/dashboard/risk-flags"
        className="inline-block text-sm font-medium text-field-1 hover:underline"
      >
        View risk flags →
      </Link>
    </div>
  )
}
