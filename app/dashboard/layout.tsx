import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { getCurrentSession } from '@/lib/current-user'
import { getUnreadAlertCount } from '@/lib/alerts/unread-count'
import { DashboardNav } from './nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()
  if (!session) {
    redirect('/login')
  }
  const { userId, db } = session

  const { data: profile } = await db
    .from('profiles')
    .select('name, field, team_role')
    .eq('id', userId)
    .maybeSingle()

  // Alerts (and the risk_flags they're built from) only exist for the
  // finance field's QuickBooks integration — skip the extra queries for
  // fields that never see the Alerts nav link.
  const unreadAlertCount = profile?.field === 'finance' ? await getUnreadAlertCount(session) : 0

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-neutral-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white dark:focus:bg-white dark:focus:text-neutral-900"
      >
        Skip to main content
      </a>
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <span className="shrink-0 text-lg font-semibold tracking-tight">Beacon</span>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {profile?.name && (
              <span className="min-w-0 truncate text-sm text-neutral-500 dark:text-neutral-400">
                {profile.name}
              </span>
            )}
            <form action={signOut} className="shrink-0">
              <button
                type="submit"
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 md:flex-row md:gap-8">
        <DashboardNav
          field={profile?.field}
          unreadAlertCount={unreadAlertCount}
          isTeamAdmin={profile?.team_role === 'admin'}
        />
        <main id="main-content" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
