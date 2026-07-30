'use client'

import { useActionState, useState } from 'react'
import { disconnectQuickbooks, type DisconnectState } from './actions'

const initialState: DisconnectState = undefined

export function DisconnectButton() {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, pending] = useActionState(disconnectQuickbooks, initialState)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        Disconnect QuickBooks
      </button>
    )
  }

  return (
    <div className="space-y-2 text-right">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Disconnect QuickBooks? Beacon will stop syncing your financials.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {pending ? 'Disconnecting…' : 'Yes, disconnect'}
          </button>
        </form>
      </div>
      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  )
}
