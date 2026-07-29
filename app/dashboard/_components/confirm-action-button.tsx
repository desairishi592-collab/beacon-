'use client'

import { useActionState, useState } from 'react'
import type { TeamActionState } from '@/lib/team-invites'

const initialState: TeamActionState = undefined

// Shared two-step (click, then confirm) destructive-action button used by
// revoke invite / remove team member / leave team — same shape, same
// TeamActionState, just a different action and hidden field.
export function ConfirmActionButton({
  action,
  hiddenField,
  label,
  confirmLabel,
  pendingLabel,
}: {
  action: (prevState: TeamActionState, formData: FormData) => Promise<TeamActionState>
  hiddenField?: { name: string; value: string }
  label: string
  confirmLabel: string
  pendingLabel: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, pending] = useActionState(action, initialState)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
      >
        {label}
      </button>
    )
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      {hiddenField && <input type="hidden" name={hiddenField.name} value={hiddenField.value} />}
      {state && 'error' in state && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-xs font-medium text-neutral-500 hover:underline disabled:opacity-60 dark:text-neutral-400"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
      >
        {pending ? pendingLabel : confirmLabel}
      </button>
    </form>
  )
}
