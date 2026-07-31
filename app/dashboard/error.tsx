'use client'

// Catches uncaught exceptions (e.g. a failed Supabase read) from any page
// under /dashboard that doesn't have its own error.tsx. Sits inside
// app/dashboard/layout.tsx's <main>, so the header and nav stay visible and
// only the page content is replaced by this fallback. Per AGENTS.md, this
// version of Next.js passes unstable_retry (re-fetches + re-renders) instead
// of relying on reset() (see node_modules/next/dist/docs/.../error.md).
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div
      role="alert"
      className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700"
    >
      <p className="text-neutral-700 dark:text-neutral-300">Something went wrong loading this page.</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">
        {error.digest ? `Error reference: ${error.digest}` : 'Please try again.'}
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-4 inline-block rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}
