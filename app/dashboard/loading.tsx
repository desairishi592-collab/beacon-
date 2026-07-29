function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded bg-neutral-200 dark:bg-neutral-800 ${className}`} />
}

// Instant fallback for any page under /dashboard that fetches its data
// directly in the page body (check-in history, organization, settings)
// rather than behind its own Suspense boundary. Renders inside
// app/dashboard/layout.tsx's <main>, so header/nav stay visible.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-56" />
        <SkeletonBlock className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="mt-2 h-5 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="mt-4 h-3 w-full" />
            <SkeletonBlock className="mt-2 h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
