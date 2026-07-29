'use client'

import { useActionState } from 'react'
import { uploadSchedule, type UploadScheduleState } from './actions'

const initialState: UploadScheduleState = undefined

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadSchedule, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        aria-label="Schedule CSV file"
        className="min-w-0 flex-1 text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200 dark:text-neutral-400 dark:file:bg-neutral-800 dark:file:text-neutral-300 dark:hover:file:bg-neutral-700"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? 'Uploading…' : 'Upload'}
      </button>

      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 sm:basis-full">
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p role="status" className="text-sm font-medium text-neutral-900 dark:text-neutral-100 sm:basis-full">
          Schedule uploaded.
        </p>
      )}
    </form>
  )
}
