'use client'

import { useActionState, useState } from 'react'
import {
  signInWithGithub,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  type AuthState,
} from '@/app/actions/auth'

const initialState: AuthState = undefined

export function LoginForm({
  initialError,
  inviteId,
  inviteEmail,
}: {
  initialError?: string
  inviteId?: string
  inviteEmail?: string
}) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(inviteId ? 'sign-up' : 'sign-in')
  const [signInState, signInAction, signInPending] = useActionState(
    signInWithPassword,
    initialState
  )
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpWithPassword,
    initialState
  )

  const action = mode === 'sign-in' ? signInAction : signUpAction
  const state = mode === 'sign-in' ? signInState : signUpState
  const pending = mode === 'sign-in' ? signInPending : signUpPending
  const error = state?.error ?? initialError
  const message = state?.message

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Continue with Google
          </button>
        </form>
        <form action={signInWithGithub}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Continue with GitHub
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        <span className="text-xs uppercase text-neutral-400">or</span>
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>

      <form action={action} className="space-y-4">
        {mode === 'sign-up' && inviteId && <input type="hidden" name="invite" value={inviteId} />}
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={inviteEmail}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {message && (
          <p role="status" className="text-sm text-green-600 dark:text-green-400">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending
            ? 'Please wait…'
            : mode === 'sign-in'
              ? 'Sign in'
              : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
        {mode === 'sign-in' ? "Don't have an account? " : 'Already have an account? '}
        <button
          type="button"
          onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
          className="font-medium text-neutral-900 underline underline-offset-2 dark:text-neutral-100"
        >
          {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
