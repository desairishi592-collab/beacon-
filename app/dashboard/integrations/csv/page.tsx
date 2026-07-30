import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { UploadForm } from '../upload-form'

export default async function CsvUploadPage() {
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
        <Link
          href="/dashboard/integrations"
          className="text-sm font-medium text-neutral-500 hover:underline dark:text-neutral-400"
        >
          ← Integrations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Scheduling CSV upload</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Export a schedule from whatever system you use (DirectShifts, a spreadsheet, or anything
          else) and upload it here as a CSV.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <UploadForm />

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
    </div>
  )
}
