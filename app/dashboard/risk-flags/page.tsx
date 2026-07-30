import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { EmptyState, RiskFlagsSection } from './risk-flags-list'

export default async function RiskFlagsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')

  const { data: upload } = await session.db
    .from('schedule_uploads')
    .select('filename, row_count, needs_mapping, created_at')
    .eq('profile_id', session.userId)
    .maybeSingle()

  const { data: flags } = upload
    ? await session.db
        .from('risk_flags')
        .select('*')
        .eq('profile_id', session.userId)
        .order('created_at', { ascending: false })
    : { data: null }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Risk Flags</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Staffing and coverage signals computed from your most recent schedule upload.
        </p>
      </div>

      {!upload ? (
        <EmptyState
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
      ) : upload.needs_mapping ? (
        <EmptyState
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
      ) : (
        <>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {upload.filename} · {upload.row_count} {upload.row_count === 1 ? 'row' : 'rows'} · uploaded{' '}
            {new Date(upload.created_at).toLocaleString()}
          </p>
          <RiskFlagsSection flags={flags ?? []} />
        </>
      )}
    </div>
  )
}
