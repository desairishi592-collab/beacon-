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
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Beacon</span>
          <div className="flex items-center gap-4">
            {profile?.name && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{profile.name}</span>
            )}
            <form action={signOut}>
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

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <DashboardNav
          field={profile?.field}
          unreadAlertCount={unreadAlertCount}
          isTeamAdmin={profile?.team_role === 'admin'}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
