'use client'

import { useActionState } from 'react'
import { confirmScheduleMapping, uploadSchedule, type ConfirmMappingState, type UploadScheduleState } from './actions'
import { ALL_CONCEPTS, CONCEPT_LABELS, REQUIRED_CONCEPTS } from '@/lib/schedule-uploads/column-mapping'

const initialUploadState: UploadScheduleState = undefined
const initialMappingState: ConfirmMappingState = undefined

function MappingForm({
  uploadId,
  columns,
  suggestedMapping,
}: {
  uploadId: string
  columns: string[]
  suggestedMapping: Partial<Record<(typeof ALL_CONCEPTS)[number], string>>
}) {
  const [state, formAction, pending] = useActionState(confirmScheduleMapping, initialMappingState)

  if (state && 'success' in state) {
    return (
      <p role="status" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        Mapping saved — {state.flagCount} risk {state.flagCount === 1 ? 'flag' : 'flags'} computed.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="uploadId" value={uploadId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        We couldn&apos;t confidently match every required column. Tell us which column is which so we
        can analyze this schedule.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ALL_CONCEPTS.map((concept) => {
          const required = REQUIRED_CONCEPTS.includes(concept)
          return (
            <label key={concept} className="block text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">
                {CONCEPT_LABELS[concept]}
                {required && <span className="text-red-600 dark:text-red-400"> *</span>}
              </span>
              <select
                name={`mapping_${concept}`}
                defaultValue={suggestedMapping[concept] ?? ''}
                required={required}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
              >
                <option value="">{required ? 'Choose a column…' : "Don't map this"}</option>
                {columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save mapping'}
      </button>

      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  )
}

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadSchedule, initialUploadState)

  if (state && 'needsMapping' in state) {
    return (
      <MappingForm
        uploadId={state.uploadId}
        columns={state.columns}
        suggestedMapping={state.suggestedMapping}
      />
    )
  }

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
        className="shrink-0 rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90 disabled:opacity-60"
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
          Schedule uploaded — {state.flagCount} risk {state.flagCount === 1 ? 'flag' : 'flags'} computed.
        </p>
      )}
    </form>
  )
}
