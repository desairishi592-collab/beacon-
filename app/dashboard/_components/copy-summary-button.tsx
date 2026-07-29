'use client'

import { useEffect, useState } from 'react'
import type { DashboardSummary } from '@/lib/dashboard/summary'
import { buildDashboardSummaryText } from '@/lib/dashboard/summary-text'

export function CopySummaryButton({ summary }: { summary: DashboardSummary }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    const text = buildDashboardSummaryText(summary)
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        Copy summary
      </button>
      {copied && (
        <div
          role="status"
          className="absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
        >
          Copied to clipboard
        </div>
      )}
    </div>
  )
}
