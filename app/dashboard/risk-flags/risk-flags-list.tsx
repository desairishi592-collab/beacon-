'use client'

import { useState } from 'react'
import type { RiskFlag, RiskSeverity } from '@/lib/supabase/types'
import { DownloadRiskFlagsReportButton } from './download-risk-flags-report-button'

// Two-tier visual treatment over the four-value severity column: critical/high
// read as "urgent" (red, warning icon), medium/low as "informational" (blue,
// info icon). Same split as the insurance analyzer's flag list.
const URGENT_SEVERITIES: RiskSeverity[] = ['critical', 'high']
const SEVERITY_RANK: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export type SeverityFilter = 'all' | RiskSeverity

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function EmptyState({
  title,
  description,
  cta,
}: {
  title: string
  description: string
  cta?: React.ReactNode
}) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
      <p className="text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">{description}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}

function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  const urgent = URGENT_SEVERITIES.includes(severity)
  return (
    <span
      className={
        urgent
          ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400'
          : 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400'
      }
    >
      {urgent ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2 20h20L12 3z" />
          <path strokeLinecap="round" d="M12 9.5v4" />
          <circle cx="12" cy="16.75" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 11v5" />
          <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      )}
      {severity[0].toUpperCase() + severity.slice(1)}
    </span>
  )
}

function RiskFlagCard({ flag }: { flag: RiskFlag }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-medium">{flag.title}</h3>
        <SeverityBadge severity={flag.severity} />
      </div>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{flag.explanation}</p>
      <div className="mt-4 rounded-md bg-neutral-50 px-4 py-3 dark:bg-neutral-800/50">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Recommendation</p>
        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{flag.recommendation}</p>
      </div>
    </div>
  )
}

function RiskFlagsList({
  flags,
  severityFilter,
  onSeverityFilterChange,
}: {
  flags: RiskFlag[]
  severityFilter: SeverityFilter
  onSeverityFilterChange: (value: SeverityFilter) => void
}) {
  const filteredFlags = flags.filter(
    (flag) => severityFilter === 'all' || flag.severity === severityFilter,
  )
  const sortedFlags = [...filteredFlags].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )

  if (flags.length === 0) {
    return (
      <EmptyState
        title="No risk flags for this period."
        description="Nothing crossed a risk threshold in your latest synced financials."
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-end">
        <label htmlFor="severity-filter" className="sr-only">
          Filter by severity
        </label>
        <select
          id="severity-filter"
          value={severityFilter}
          onChange={(e) => onSeverityFilterChange(e.target.value as SeverityFilter)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {sortedFlags.length === 0 ? (
        <EmptyState
          title="No flags match this filter."
          description="Try a different severity, or clear the filter to see all risk flags."
        />
      ) : (
        <div className="mt-4 space-y-4">
          {sortedFlags.map((flag) => (
            <RiskFlagCard key={flag.id} flag={flag} />
          ))}
        </div>
      )}
    </div>
  )
}

export function RiskFlagsSection({ flags }: { flags: RiskFlag[] }) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')

  const filteredFlags = flags.filter(
    (flag) => severityFilter === 'all' || flag.severity === severityFilter,
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Flags</h2>
        {filteredFlags.length > 0 && <DownloadRiskFlagsReportButton flags={filteredFlags} />}
      </div>
      <RiskFlagsList
        flags={flags}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
      />
    </div>
  )
}
