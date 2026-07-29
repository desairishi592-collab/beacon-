import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { UploadForm } from './upload-form'

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

export default async function IntegrationsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: upload } = await db
    .from('schedule_uploads')
    .select('filename, row_count, columns, preview_rows, created_at')
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
          <ActiveBadge />
        </div>

        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <UploadForm />
        </div>

        {upload && (
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <span className="font-medium">{upload.filename}</span> · {upload.row_count}{' '}
              {upload.row_count === 1 ? 'row' : 'rows'} · uploaded{' '}
              {new Date(upload.created_at).toLocaleString()}
            </p>

            {upload.preview_rows.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[400px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800">
                      {upload.columns.map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className="whitespace-nowrap px-2 py-1.5 font-medium text-neutral-500 dark:text-neutral-400"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {upload.preview_rows.map((row, index) => (
                      <tr key={index} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                        {upload.columns.map((column) => (
                          <td key={column} className="whitespace-nowrap px-2 py-1.5 text-neutral-700 dark:text-neutral-300">
                            {row[column]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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
