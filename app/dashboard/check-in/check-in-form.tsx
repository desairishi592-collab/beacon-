'use client'

import { useActionState } from 'react'
import { submitCheckIn, type CheckInState } from './actions'
import { RATING_SCALE, type CheckInQuestion } from '@/lib/check-ins/questions'

const initialState: CheckInState = undefined

// Fields are plain uncontrolled inputs: in this Next.js version, the client
// tree under a form action remounts once its response lands regardless of
// outcome (success or error, whether or not the action revalidates), so
// controlled React state gets wiped exactly the same as uncontrolled DOM
// state would. There's nothing to gain from controlling these — see
// AGENTS.md on this app's Next.js not matching stock behavior.
export function CheckInForm({ questions }: { questions: CheckInQuestion[] }) {
  const [state, formAction, pending] = useActionState(submitCheckIn, initialState)

  return (
    <form action={formAction} className="space-y-6">
      {questions.map((question) => (
        <fieldset key={question.id} className="space-y-2">
          <legend className="text-sm font-medium">{question.prompt}</legend>
          <div className="flex flex-wrap gap-2">
            {RATING_SCALE.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900 has-[:focus-visible]:ring-offset-2 dark:border-neutral-700 dark:has-[:checked]:border-white dark:has-[:checked]:bg-white dark:has-[:checked]:text-neutral-900 dark:has-[:focus-visible]:ring-white dark:has-[:focus-visible]:ring-offset-neutral-950"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  required
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Anything else worth flagging? <span className="font-normal text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state && 'success' in state && (
        <p role="status" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Check-in recorded.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? 'Submitting…' : 'Submit check-in'}
      </button>
    </form>
  )
}
