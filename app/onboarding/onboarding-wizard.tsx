'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { completeOnboarding, type OnboardingState } from './actions'

const FIELD_OPTIONS = [
  { value: 'finance', label: 'Finance' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'other', label: 'Other' },
]

const STEPS = ['Name', 'Company', 'Role', 'Field', 'Data source'] as const

const initialState: OnboardingState = undefined

export function OnboardingWizard({ inviteId }: { inviteId?: string }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('')
  const [field, setField] = useState('')
  const [wantsDataIntegration, setWantsDataIntegration] = useState<boolean | null>(null)
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState)

  const isLastStep = step === STEPS.length - 1
  const canContinue =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? companyName.trim().length > 0
        : step === 2
          ? role.trim().length > 0
          : field.length > 0

  function goNext(e: FormEvent) {
    e.preventDefault()
    if (!canContinue) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        className="mb-6 flex gap-1.5"
      >
        {STEPS.map((label, i) => (
          <div
            key={label}
            aria-hidden="true"
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'
            }`}
          />
        ))}
      </div>
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>

      {!isLastStep ? (
        <form onSubmit={goNext} className="space-y-4">
          {step === 0 && (
            <div className="space-y-1">
              <label htmlFor="name" className="text-sm font-medium">
                Your name
              </label>
              <input
                id="name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
          )}
          {step === 1 && (
            <div className="space-y-1">
              <label htmlFor="company_name" className="text-sm font-medium">
                Company name
              </label>
              <input
                id="company_name"
                autoFocus
                placeholder="e.g. Acme Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-1">
              <label htmlFor="role" className="text-sm font-medium">
                Position / role
              </label>
              <input
                id="role"
                autoFocus
                placeholder="e.g. Finance Manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
          )}
          {step === 3 && (
            <div className="space-y-1">
              <label htmlFor="field" className="text-sm font-medium">
                Which field are you in?
              </label>
              <select
                id="field"
                autoFocus
                value={field}
                onChange={(e) => setField(e.target.value)}
                required
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
              >
                <option value="" disabled>
                  Select a field…
                </option>
                {FIELD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="text-sm font-medium text-neutral-500 disabled:opacity-0 dark:text-neutral-400"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!canContinue}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              Continue
            </button>
          </div>
        </form>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="company_name" value={companyName} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="field" value={field} />
          <input
            type="hidden"
            name="wants_data_integration"
            value={wantsDataIntegration === null ? '' : wantsDataIntegration ? 'yes' : 'no'}
          />
          {inviteId && <input type="hidden" name="invite" value={inviteId} />}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Can we integrate with your database/systems?
            </label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              If yes, we&apos;ll take you straight into connecting a data source (like a staffing
              schedule or your financial data) after this. If no, you can do quick manual check-ins instead
              — and connect a data source later from Settings any time.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => setWantsDataIntegration(true)}
                aria-pressed={wantsDataIntegration === true}
                className={`rounded-md border px-4 py-2 text-sm font-medium ${
                  wantsDataIntegration === true
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWantsDataIntegration(false)}
                aria-pressed={wantsDataIntegration === false}
                className={`rounded-md border px-4 py-2 text-sm font-medium ${
                  wantsDataIntegration === false
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={pending || wantsDataIntegration === null}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {pending ? 'Saving…' : 'Finish'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
