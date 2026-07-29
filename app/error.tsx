'use client'

// Root error boundary. Catches failures that error.tsx files inside route
// segments can't — most notably app/dashboard/layout.tsx (the profile and
// unread-alert-count queries that run before the header/nav render), since
// error.tsx never wraps the layout.tsx in its own segment (see
// node_modules/next/dist/docs/.../error.md). Without this, those failures
// fell through to Next's default error page.
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-neutral-50 px-6 dark:bg-neutral-950">
      <div role="alert" className="max-w-sm text-center">
        <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          Something went wrong.
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {error.digest ? `Error reference: ${error.digest}` : "We couldn't load this page."}
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
