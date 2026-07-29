'use client'

import { useActionState } from 'react'
import { syncQuickbooks, type SyncState } from './actions'

const initialState: SyncState = undefined

export function SyncButton() {
  const [state, formAction, pending] = useActionState(syncQuickbooks, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        {pending ? 'Syncing…' : 'Sync now'}
      </button>
      {state && 'error' in state && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state && 'snapshotsSynced' in state && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Synced {state.snapshotsSynced} {state.snapshotsSynced === 1 ? 'period' : 'periods'}.
        </p>
      )}
    </form>
  )
}
