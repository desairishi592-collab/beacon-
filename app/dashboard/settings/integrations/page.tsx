import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'
import { SyncButton } from './sync-button'
import { DisconnectButton } from './disconnect-button'
import { GithubConnectForm, GithubSyncButton, GithubDisconnectButton } from './github-panel'

function ComingSoonBadge() {
  return (
    <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      Coming soon
    </span>
  )
}

function ActiveBadge() {
  return (
    <span className="shrink-0 rounded-full bg-field-1 px-2.5 py-1 text-xs font-medium text-field-1-fg">
      Active
    </span>
  )
}

function ConnectedBadge() {
  return (
    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-400">
      Connected
    </span>
  )
}

function NeedsAttentionBadge() {
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-400">
      Needs attention
    </span>
  )
}

function ManualCheckinPanel() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Manual check-in</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            No data source? Answer a short check-in yourself, periodically.
          </p>
        </div>
        <ActiveBadge />
      </div>
      <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Link href="/dashboard/check-in" className="text-sm font-medium text-field-1 hover:underline">
          Go to check-in →
        </Link>
      </div>
    </div>
  )
}

async function ScheduleIntegrationsPanel({
  userId,
  db,
}: {
  userId: string
  db: SupabaseClient<Database>
}) {
  const { data: upload } = await db
    .from('schedule_uploads')
    .select('filename, needs_mapping, created_at')
    .eq('profile_id', userId)
    .maybeSingle()

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">DirectShifts</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Pull staffing and scheduling data directly from your DirectShifts account.
            </p>
          </div>
          <ComingSoonBadge />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-medium">Scheduling CSV upload</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Export a schedule from whatever system you use (DirectShifts, a spreadsheet, or
              anything else) and upload it here as a CSV.
            </p>
          </div>
          {!upload ? <ActiveBadge /> : upload.needs_mapping ? <NeedsAttentionBadge /> : <ConnectedBadge />}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          {upload ? (
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <span className="font-medium">{upload.filename}</span> · last uploaded{' '}
              {new Date(upload.created_at).toLocaleString()}
              {upload.needs_mapping && (
                <span className="block text-amber-700 dark:text-amber-400">
                  A few columns still need to be confirmed before this can be analyzed.
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No schedule uploaded yet.</p>
          )}

          <Link
            href="/dashboard/settings/integrations/csv"
            className="shrink-0 rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
          >
            {upload ? (upload.needs_mapping ? 'Finish setup' : 'Replace file') : 'Upload schedule'}
          </Link>
        </div>
      </div>

      <ManualCheckinPanel />
    </>
  )
}

async function GithubIntegrationsPanel({ userId }: { userId: string }) {
  // github_connections has no user-facing select policy (it holds a bearer
  // token) — read connection status through the service role and only
  // surface the non-sensitive columns, same pattern as
  // quickbooks_connections below.
  const db = createAdminClient()
  const { data: connection } = await db
    .from('github_connections')
    .select('repo_owner, repo_name, last_synced_at')
    .eq('profile_id', userId)
    .maybeSingle()

  return (
    <>
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <p className="font-medium text-neutral-900 dark:text-neutral-100">Read-only access</p>
        <p className="mt-1">
          Beacon only ever reads from GitHub — open pull requests, open issues, and commit history.
          It never writes, comments on, or modifies anything in your repository. Create a{' '}
          <span className="font-medium">fine-grained personal access token</span> scoped to just this
          repository with <span className="font-medium">Contents</span>,{' '}
          <span className="font-medium">Issues</span>, <span className="font-medium">Pull requests</span>,
          and <span className="font-medium">Metadata</span> permissions all set to{' '}
          <span className="font-medium">Read-only</span> — Beacon will never ask for anything more.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-medium">GitHub</h2>
            {connection ? (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {connection.repo_owner}/{connection.repo_name} ·{' '}
                {connection.last_synced_at
                  ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
                  : 'Not synced yet'}
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Not connected</p>
            )}
          </div>
          {connection && <ConnectedBadge />}
        </div>

        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          {connection ? (
            <div className="flex flex-wrap items-start gap-2">
              <GithubSyncButton />
              <GithubDisconnectButton />
            </div>
          ) : (
            <GithubConnectForm />
          )}
        </div>
      </div>

      <ManualCheckinPanel />
    </>
  )
}

async function QuickbooksIntegrationsPanel({
  userId,
  params,
}: {
  userId: string
  params: { connected?: string; qb_error?: string; qb_sync_error?: string }
}) {
  // quickbooks_connections has no user-facing select policy (it holds
  // bearer tokens) — read connection status through the service role and
  // only surface the non-sensitive columns.
  const db = createAdminClient()
  const { data: connection } = await db
    .from('quickbooks_connections')
    .select('realm_id, last_synced_at, created_at')
    .eq('profile_id', userId)
    .maybeSingle()

  // Sync run history is service-role-only (see quickbooks_sync_runs' RLS
  // note) purely to match the pattern used for the connection row above —
  // there's nothing sensitive in these columns.
  const { data: syncRuns } = connection
    ? await db
        .from('quickbooks_sync_runs')
        .select('id, trigger, status, snapshots_synced, error_message, finished_at')
        .eq('profile_id', userId)
        .order('finished_at', { ascending: false })
        .limit(5)
    : { data: null }

  return (
    <>
      {params.qb_error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {params.qb_error}
        </p>
      )}
      {params.connected && params.qb_sync_error && (
        <p className="rounded-md border border-red-100 bg-red-50/50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
          Connected, but the initial sync failed: {params.qb_sync_error}
        </p>
      )}
      {params.connected && !params.qb_sync_error && (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          Financial data connected and synced.
        </p>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-medium">Financial data</h2>
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
            <div className="flex flex-wrap items-start gap-2">
              <SyncButton />
              <DisconnectButton />
            </div>
          ) : (
            <a
              href="/api/quickbooks/connect"
              className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
            >
              Connect your financial data
            </a>
          )}
        </div>

        {syncRuns && syncRuns.length > 0 && (
          <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Recent sync activity
            </h3>
            <ul className="mt-2 space-y-2">
              {syncRuns.map((run) => (
                <li key={run.id} className="flex items-start justify-between gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <span
                      className={
                        run.status === 'success'
                          ? 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500'
                          : 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500'
                      }
                    />
                    <div>
                      <p className="text-neutral-700 dark:text-neutral-300">
                        {run.trigger === 'cron' ? 'Scheduled sync' : 'Manual sync'}
                        {run.status === 'success'
                          ? ` · synced ${run.snapshots_synced} ${run.snapshots_synced === 1 ? 'period' : 'periods'}`
                          : ' · failed'}
                      </p>
                      {run.error_message && (
                        <p className="mt-0.5 text-red-600 dark:text-red-400">{run.error_message}</p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-neutral-400 dark:text-neutral-600">
                    {new Date(run.finished_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; qb_error?: string; qb_sync_error?: string }>
}) {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session
  const params = await searchParams

  const { data: profile } = await db.from('profiles').select('field').eq('id', userId).maybeSingle()
  const field = profile?.field
  const showCheckInPath = profile ? isManualCheckinField(profile.field) : true
  const isEngineering = field === 'engineering'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          {isEngineering
            ? 'Connect a GitHub repository for real risk signals, or keep using manual check-ins.'
            : showCheckInPath
              ? 'Connect a staffing or scheduling data source, or keep using manual check-ins.'
              : 'Connect your financial data so Beacon can monitor your financials for risk.'}
        </p>
      </div>

      {isEngineering ? (
        <GithubIntegrationsPanel userId={userId} />
      ) : showCheckInPath ? (
        <ScheduleIntegrationsPanel userId={userId} db={db} />
      ) : (
        <QuickbooksIntegrationsPanel userId={userId} params={params} />
      )}
    </div>
  )
}
