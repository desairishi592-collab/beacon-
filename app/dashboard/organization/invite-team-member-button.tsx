'use client'

import { useActionState, useState } from 'react'
import { inviteTeamMember, type InviteState } from './actions'

const initialState: InviteState = undefined

export function InviteTeamMemberButton() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Invite team member
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="invite-email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="teammate@company.com"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="invite-role" className="text-sm font-medium">
          Role
        </label>
        <select
          id="invite-role"
          name="role"
          defaultValue="member"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-green-600 dark:text-green-400">Invite sent to {state.email}.</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending ? 'Sending…' : 'Send invite'}
        </button>
      </div>
    </form>
  )
}
