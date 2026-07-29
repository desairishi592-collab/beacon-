import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { SettingsForm } from './settings-form'
import { InviteTeamMemberButton } from './invite-team-member-button'

export default async function SettingsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile } = await db
    .from('profiles')
    .select('name, role, team_size')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) redirect('/onboarding')

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

      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-medium">Team</h2>
        <p className="mt-1 mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          Invite a team member to join your Beacon account.
        </p>
        <InviteTeamMemberButton />
      </div>
    </div>
  )
}
