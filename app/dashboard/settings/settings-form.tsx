'use client'

import { useActionState } from 'react'
import { updateProfile, type SettingsState } from './actions'

const initialState: SettingsState = undefined

// Uncontrolled inputs with defaultValue — see AGENTS.md / check-in-form.tsx on
// why controlling these buys nothing in this Next.js version.
export function SettingsForm({
  name,
  role,
  teamSize,
  weeklyDigestEnabled,
  nextDigestLabel,
  checkInReminderEnabled,
}: {
  name: string
  role: string
  teamSize: number
  weeklyDigestEnabled: boolean
  nextDigestLabel: string | null
  checkInReminderEnabled: boolean
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Your name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="role" className="text-sm font-medium">
          Position / role
        </label>
        <input
          id="role"
          name="role"
          placeholder="e.g. Finance Manager"
          defaultValue={role}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="team_size" className="text-sm font-medium">
          Team size
        </label>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          How many people do you manage?
        </p>
        <input
          id="team_size"
          name="team_size"
          type="number"
          min={1}
          step={1}
          defaultValue={teamSize}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <div className="flex items-start gap-2 pt-2">
        <input
          id="weekly_digest_enabled"
          name="weekly_digest_enabled"
          type="checkbox"
          defaultChecked={weeklyDigestEnabled}
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-field-1 dark:border-neutral-700"
        />
        <label htmlFor="weekly_digest_enabled" className="text-sm">
          <span className="font-medium">Weekly email digest</span>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Get your status summary — overall status, open risk flags, and any urgent
            indicators — emailed to you once a week.
          </p>
          {nextDigestLabel && (
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              Next digest: {nextDigestLabel}
            </p>
          )}
        </label>
      </div>

      <div className="flex items-start gap-2 pt-2">
        <input
          id="check_in_reminder_enabled"
          name="check_in_reminder_enabled"
          type="checkbox"
          defaultChecked={checkInReminderEnabled}
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-field-1 dark:border-neutral-700"
        />
        <label htmlFor="check_in_reminder_enabled" className="text-sm">
          <span className="font-medium">Check-in reminder emails</span>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Get an email nudge if it&apos;s been a week or more since your last check-in.
          </p>
        </label>
      </div>

      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state && 'success' in state && (
        <p role="status" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Profile updated.</p>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
