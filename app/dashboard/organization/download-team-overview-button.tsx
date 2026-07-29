'use client'

import { buildTeamOverviewCsv, type TeamOverviewRow } from '@/lib/organization/csv'

export function DownloadTeamOverviewButton({ rows }: { rows: TeamOverviewRow[] }) {
  function handleDownload() {
    const csv = buildTeamOverviewCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `team-overview-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
    >
      Download team overview
    </button>
  )
}
