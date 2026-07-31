import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { getNextWeeklyDigestAt } from '@/lib/notifications/weekly-digest'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import { SettingsForm } from './settings-form'
import { ConfirmActionButton } from '../_components/confirm-action-button'
import { leaveTeam } from './actions'

export default async function SettingsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile, error } = await db
    .from('profiles')
    .select(
      'name, role, field, team_size, team_role, weekly_digest_enabled, check_in_reminder_enabled, wants_data_integration'
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!profile) redirect('/onboarding')

  const isAdmin = profile.team_role === 'admin'

  const nextDigestLabel = profile.weekly_digest_enabled
    ? getNextWeeklyDigestAt().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Update your profile details.
        </p>
      </div>

      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <SettingsForm
          name={profile.name}
          role={profile.role}
          teamSize={profile.team_size}
          weeklyDigestEnabled={profile.weekly_digest_enabled}
          nextDigestLabel={nextDigestLabel}
          checkInReminderEnabled={profile.check_in_reminder_enabled}
        />
      </div>

      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-medium">Data connection</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {profile.wants_data_integration
            ? isManualCheckinField(profile.field)
              ? 'Connect a staffing schedule, or keep using manual check-ins.'
              : 'Connect your financial data so Beacon can monitor your financials for risk.'
            : "You chose manual check-ins during setup. You can connect a data source any time."}
        </p>
        <Link
          href="/dashboard/settings/integrations"
          className="mt-3 inline-block rounded-md bg-field-1 px-4 py-2 text-sm font-medium text-field-1-fg hover:opacity-90"
        >
          Manage data connection →
        </Link>
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
