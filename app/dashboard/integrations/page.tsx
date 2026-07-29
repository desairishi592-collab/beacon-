import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { SyncButton } from './sync-button'

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; qb_error?: string; qb_sync_error?: string }>
}) {
  const session = await getCurrentSession()
  if (!session) redirect('/login')

  const params = await searchParams

  // quickbooks_connections has no user-facing select policy (it holds
  // bearer tokens) — read connection status through the service role and
  // only surface the non-sensitive columns.
  const db = createAdminClient()
  const { data: connection } = await db
    .from('quickbooks_connections')
    .select('realm_id, last_synced_at, created_at')
    .eq('profile_id', session.userId)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Connect QuickBooks so Beacon can monitor your financials for risk.
        </p>
      </div>

      {params.qb_error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {params.qb_error}
        </p>
      )}
      {params.connected && params.qb_sync_error && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          Connected, but the initial sync failed: {params.qb_sync_error}
        </p>
      )}
      {params.connected && !params.qb_sync_error && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
          QuickBooks connected and synced.
        </p>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">QuickBooks</h2>
            {connection ? (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Company {connection.realm_id} ·{' '}
                {connection.last_synced_at
                  ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
                  : 'Not synced yet'}
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Not connected</p>
            )}
          </div>

          {connection ? (
            <SyncButton />
          ) : (
            <a
              href="/api/quickbooks/connect"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Connect QuickBooks
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
