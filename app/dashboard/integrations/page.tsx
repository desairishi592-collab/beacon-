import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'

function ComingSoonBadge() {
  return (
    <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      Coming soon
    </span>
  )
}

function ActiveBadge() {
  return (
    <span className="shrink-0 rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-900">
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

export default async function IntegrationsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: upload } = await db
    .from('schedule_uploads')
    .select('filename, needs_mapping, created_at')
    .eq('profile_id', userId)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Connect a staffing or scheduling data source, or keep using manual check-ins.
        </p>
      </div>

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
            href="/dashboard/integrations/csv"
            className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {upload ? (upload.needs_mapping ? 'Finish setup' : 'Replace file') : 'Upload schedule'}
          </Link>
        </div>
      </div>

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
          <Link
            href="/dashboard/check-in"
            className="text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100"
          >
            Go to check-in →
          </Link>
        </div>
      </div>
    </div>
  )
}
