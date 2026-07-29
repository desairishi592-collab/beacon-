import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { SettingsForm } from './settings-form'
import { ConfirmActionButton } from '../_components/confirm-action-button'
import { leaveTeam } from './actions'

export default async function SettingsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile } = await db
    .from('profiles')
    .select('name, role, team_size, team_role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) redirect('/onboarding')

  const isAdmin = profile.team_role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Update your profile details.
        </p>
      </div>

      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <SettingsForm name={profile.name} role={profile.role} teamSize={profile.team_size} />
      </div>

      {!isAdmin && (
        <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Team</h2>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Member
            </span>
          </div>
          <div className="mt-1 space-y-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              You&apos;re a member of a team invited by your admin. Only the team admin can invite
              or remove members.
            </p>
            <ConfirmActionButton
              action={leaveTeam}
              label="Leave team"
              confirmLabel="Confirm leave"
              pendingLabel="Leaving…"
            />
          </div>
        </div>
      )}
    </div>
  )
}
