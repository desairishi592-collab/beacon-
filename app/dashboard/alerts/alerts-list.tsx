'use client'

import { useActionState } from 'react'
import type { AlertState, RiskFlag, RiskSeverity } from '@/lib/supabase/types'
import { dismissAlert, markAlertRead, type AlertActionState } from './actions'

const URGENT_SEVERITIES: RiskSeverity[] = ['critical', 'high']

export type AlertItem = {
  flag: RiskFlag
  state: AlertState | null
}

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

const initialActionState: AlertActionState = undefined

function AlertCard({ flag, state }: AlertItem) {
  const isRead = Boolean(state?.read_at)
  const [readState, readAction, readPending] = useActionState(markAlertRead, initialActionState)
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissAlert, initialActionState)

  return (
    <div
      className={
        isRead
          ? 'rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900'
          : 'rounded-lg border border-neutral-300 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900'
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          {!isRead && (
            <span
              aria-label="Unread"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400"
            />
          )}
          <h3 className="font-medium">{flag.title}</h3>
        </div>
        <SeverityBadge severity={flag.severity} />
      </div>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{flag.explanation}</p>
      <div className="mt-4 rounded-md bg-neutral-50 px-4 py-3 dark:bg-neutral-800/50">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Recommendation</p>
        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{flag.recommendation}</p>
      </div>

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

      {readState && 'error' in readState && (
        <p className="mt-2 text-right text-sm text-red-600 dark:text-red-400">{readState.error}</p>
      )}
      {dismissState && 'error' in dismissState && (
        <p className="mt-2 text-right text-sm text-red-600 dark:text-red-400">{dismissState.error}</p>
      )}
    </div>
  )
}

export function AlertsList({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        title="You're all caught up."
        description="No active alerts right now. Beacon will flag new signals here as your synced financials change."
      />
    )
  }

  return (
    <div className="space-y-4">
      {alerts.map(({ flag, state }) => (
        <AlertCard key={flag.id} flag={flag} state={state} />
      ))}
    </div>
  )
}
