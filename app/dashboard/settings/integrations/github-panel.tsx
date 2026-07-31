'use client'

import { useActionState, useState } from 'react'
import {
  connectGithub,
  disconnectGithub,
  syncGithub,
  type ConnectGithubState,
  type DisconnectGithubState,
  type SyncGithubState,
} from './actions'

const initialConnectState: ConnectGithubState = undefined
const initialSyncState: SyncGithubState = undefined
const initialDisconnectState: DisconnectGithubState = undefined

export function GithubConnectForm() {
  const [state, formAction, pending] = useActionState(connectGithub, initialConnectState)

  if (state && 'success' in state) {
    return (
      <div className="space-y-1">
        <p role="status" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Connected — {state.flagsComputed} risk {state.flagsComputed === 1 ? 'flag' : 'flags'} computed.
        </p>
        {state.syncError && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Connected, but the initial sync failed: {state.syncError}. Use &quot;Sync now&quot; to retry.
          </p>
        )}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm">
        <span className="text-neutral-700 dark:text-neutral-300">Repository</span>
        <input
          type="text"
          name="repo"
          required
          placeholder="owner/repo"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </label>
      <label className="block text-sm">
        <span className="text-neutral-700 dark:text-neutral-300">Fine-grained personal access token</span>
        <input
          type="password"
          name="token"
          required
          autoComplete="off"
          placeholder="github_pat_…"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Connecting…' : 'Connect'}
      </button>

      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  )
}

export function GithubSyncButton() {
  const [state, formAction, pending] = useActionState(syncGithub, initialSyncState)

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
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state && 'flagsComputed' in state && (
        <p role="status" className="text-sm text-neutral-500 dark:text-neutral-400">
          Synced — {state.flagsComputed} risk {state.flagsComputed === 1 ? 'flag' : 'flags'} computed.
        </p>
      )}
    </form>
  )
}

export function GithubDisconnectButton() {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, pending] = useActionState(disconnectGithub, initialDisconnectState)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        Disconnect GitHub
      </button>
    )
  }

  return (
    <div className="space-y-2 text-right">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Disconnect GitHub? Beacon will stop syncing this repository and delete the stored token.
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
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </div>
  )
}
