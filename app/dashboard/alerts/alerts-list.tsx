'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import type { AlertState, RiskFlag, RiskSeverity, RiskSignalType } from '@/lib/supabase/types'
import { SIGNAL_TYPE_LABELS, URGENT_SEVERITIES, resolveChannel } from '@/lib/notifications/channels'
import { dismissAlert, markAlertRead, type AlertActionState } from './actions'

export type AlertItem = {
  flag: RiskFlag
  state: AlertState | null
}

type SeverityFilter = 'all' | RiskSeverity
type TypeFilter = 'all' | RiskSignalType

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  ...(Object.entries(SIGNAL_TYPE_LABELS) as [RiskSignalType, string][]).map(([value, label]) => ({
    value,
    label,
  })),
]

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
      <p className="text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">{description}</p>
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
          : 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
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

function ChannelBadge({ emailed }: { emailed: boolean }) {
  return (
    <span
      className={
        emailed
          ? 'inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
          : 'inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
      }
    >
      {emailed ? 'Email + in-app' : 'In-app only'}
    </span>
  )
}

const initialActionState: AlertActionState = undefined

function AlertCard({ flag, state, emailed }: AlertItem & { emailed: boolean }) {
  const isRead = Boolean(state?.read_at)
  const isDismissed = Boolean(state?.dismissed_at)
  const [readState, readAction, readPending] = useActionState(markAlertRead, initialActionState)
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissAlert, initialActionState)

  return (
    <div
      className={
        isDismissed
          ? 'rounded-lg border border-neutral-200 bg-neutral-50/60 p-6 opacity-60 dark:border-neutral-800 dark:bg-neutral-900/40'
          : isRead
            ? 'rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'
            : 'rounded-lg border border-neutral-300 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900'
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-2">
          {!isRead && !isDismissed && (
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral-900 dark:bg-neutral-100"
            />
          )}
          {!isRead && !isDismissed && <span className="sr-only">Unread: </span>}
          <h3 className="font-medium">{flag.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <ChannelBadge emailed={emailed} />
          <SeverityBadge severity={flag.severity} />
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        {SIGNAL_TYPE_LABELS[flag.signal_type]} ·{' '}
        {new Date(flag.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{flag.explanation}</p>
      <div className="mt-4 rounded-md bg-neutral-50 px-4 py-3 dark:bg-neutral-800/50">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Recommendation</p>
        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{flag.recommendation}</p>
      </div>

      {isDismissed ? (
        <p className="mt-4 text-right text-sm text-neutral-400 dark:text-neutral-600">Dismissed</p>
      ) : (
        <div className="mt-4 flex items-center justify-end gap-2">
          {!isRead && (
            <form action={readAction}>
              <input type="hidden" name="riskFlagId" value={flag.id} />
              <button
                type="submit"
                disabled={readPending}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {readPending ? 'Marking…' : 'Mark as read'}
              </button>
            </form>
          )}
          <form action={dismissAction}>
            <input type="hidden" name="riskFlagId" value={flag.id} />
            <button
              type="submit"
              disabled={dismissPending}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {dismissPending ? 'Dismissing…' : 'Dismiss'}
            </button>
          </form>
        </div>
      )}

      {readState && 'error' in readState && (
        <p role="alert" className="mt-2 text-right text-sm text-red-600 dark:text-red-400">{readState.error}</p>
      )}
      {dismissState && 'error' in dismissState && (
        <p role="alert" className="mt-2 text-right text-sm text-red-600 dark:text-red-400">{dismissState.error}</p>
      )}
    </div>
  )
}

export function AlertsList({
  alerts,
  emailDisabledTypes,
}: {
  alerts: AlertItem[]
  emailDisabledTypes: RiskSignalType[]
}) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const disabledTypes = new Set(emailDisabledTypes)

  if (alerts.length === 0) {
    return (
      <EmptyState
        title="You're all caught up."
        description="No alerts yet. Beacon will list new signals here as your synced financials change."
      />
    )
  }

  const filteredAlerts = alerts.filter(
    ({ flag }) =>
      (severityFilter === 'all' || flag.severity === severityFilter) &&
      (typeFilter === 'all' || flag.signal_type === typeFilter),
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label htmlFor="type-filter" className="sr-only">
          Filter by type
        </label>
        <select
          id="type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="min-w-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label htmlFor="severity-filter" className="sr-only">
          Filter by severity
        </label>
        <select
          id="severity-filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
          className="min-w-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {filteredAlerts.length === 0 ? (
        <EmptyState
          title="No alerts match this filter."
          description="Try a different type or severity, or clear the filters to see all alerts."
        />
      ) : (
        <div className="mt-4 space-y-4">
          {filteredAlerts.map(({ flag, state }) => (
            <AlertCard
              key={flag.id}
              flag={flag}
              state={state}
              emailed={resolveChannel(flag.severity, flag.signal_type, disabledTypes) === 'email_and_in_app'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
