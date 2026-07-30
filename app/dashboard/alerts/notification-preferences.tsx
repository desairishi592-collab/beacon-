'use client'

import { useActionState } from 'react'
import { SIGNAL_TYPE_LABELS } from '@/lib/notifications/channels'
import type { NotificationPreference } from '@/lib/supabase/types'
import { updateNotificationPreference, type AlertActionState } from './actions'

const initialActionState: AlertActionState = undefined

function PreferenceRow({ preference }: { preference: NotificationPreference }) {
  const [state, action, pending] = useActionState(updateNotificationPreference, initialActionState)

  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 py-3 last:border-0 dark:border-neutral-800">
      <div>
        <p className="text-sm font-medium">{SIGNAL_TYPE_LABELS[preference.signal_type]}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Critical/high alerts of this type {preference.email_enabled ? 'also email you' : 'stay in-app only'}.
        </p>
        {state && 'error' in state && (
          <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
        )}
      </div>
      <form action={action}>
        <input type="hidden" name="signalType" value={preference.signal_type} />
        <input type="hidden" name="emailEnabled" value={String(!preference.email_enabled)} />
        <button
          type="submit"
          disabled={pending}
          aria-pressed={preference.email_enabled}
          aria-label={`${preference.email_enabled ? 'Disable' : 'Enable'} email for ${SIGNAL_TYPE_LABELS[preference.signal_type]}`}
          className={
            preference.email_enabled
              ? 'relative h-6 w-11 shrink-0 rounded-full bg-neutral-900 transition-colors disabled:opacity-60 dark:bg-white'
              : 'relative h-6 w-11 shrink-0 rounded-full bg-neutral-200 transition-colors disabled:opacity-60 dark:bg-neutral-700'
          }
        >
          <span
            className={
              preference.email_enabled
                ? 'absolute top-0.5 left-5 h-5 w-5 rounded-full bg-white transition-transform dark:bg-neutral-900'
                : 'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform dark:bg-neutral-900'
            }
          />
        </button>
      </form>
    </div>
  )
}

export function NotificationPreferences({ preferences }: { preferences: NotificationPreference[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="font-medium">Notification preferences</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Every alert always shows up here in-app. Choose which types also send an email when they&apos;re
        critical or high severity.
      </p>
      <div className="mt-4">
        {preferences.map((preference) => (
          <PreferenceRow key={preference.signal_type} preference={preference} />
        ))}
      </div>
    </div>
  )
}
