'use client'

import type { RiskFlag } from '@/lib/supabase/types'
import { buildRiskFlagsCsv } from '@/lib/risk-flags/csv'

export function DownloadRiskFlagsReportButton({ flags }: { flags: RiskFlag[] }) {
  function handleDownload() {
    const csv = buildRiskFlagsCsv(flags)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `risk-flags-${new Date().toISOString().slice(0, 10)}.csv`
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
      Download report
    </button>
  )
}
