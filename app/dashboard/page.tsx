import { getCurrentSession } from '@/lib/current-user'

export default async function DashboardHomePage() {
  const session = await getCurrentSession()

  const { data: profile } = session
    ? await session.db.from('profiles').select('name, field').eq('id', session.userId).maybeSingle()
    : { data: null }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{profile?.name ? `, ${profile.name}` : ''}
      </h1>
      <p className="mt-1 text-neutral-500 dark:text-neutral-400">
        Here&apos;s your risk overview.
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
        <p className="text-neutral-500 dark:text-neutral-400">No integrations connected yet.</p>
        <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">
          Connect QuickBooks to start monitoring risk flags.
        </p>
      </div>
    </div>
  )
}
