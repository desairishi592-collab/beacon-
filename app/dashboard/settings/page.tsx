import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { SettingsForm } from './settings-form'
import { InviteTeamMemberButton } from './invite-team-member-button'
import { ConfirmActionButton } from './confirm-action-button'
import { revokeInvite, removeTeamMember, leaveTeam } from './actions'

export default async function SettingsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile } = await db
    .from('profiles')
    .select('name, role, team_size, team_id, team_role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) redirect('/onboarding')

  const isAdmin = profile.team_role === 'admin'

  const [{ data: pendingInvites }, { data: teamMembers }] = isAdmin
    ? await Promise.all([
        db
          .from('team_invites')
          .select('id, invitee_email, created_at')
          .eq('inviter_profile_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        db
          .from('profiles')
          .select('id, name, role, field')
          .eq('team_id', profile.team_id)
          .neq('id', userId)
          .order('name', { ascending: true }),
      ])
    : [{ data: null }, { data: null }]

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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Team</h2>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {isAdmin ? 'Admin' : 'Member'}
          </span>
        </div>

        {isAdmin ? (
          <>
            <p className="mt-1 mb-4 text-xs text-neutral-500 dark:text-neutral-400">
              Invite a team member to join your Beacon account. As the team admin, you can see
              teammates&apos; check-ins on the{' '}
              <a href="/dashboard/team" className="underline">
                Team
              </a>{' '}
              page.
            </p>
            <InviteTeamMemberButton />

            {teamMembers && teamMembers.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Members
                </h3>
                <ul className="space-y-2">
                  {teamMembers.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
                    >
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{member.role}</p>
                      </div>
                      <ConfirmActionButton
                        action={removeTeamMember}
                        hiddenField={{ name: 'member_id', value: member.id }}
                        label="Remove"
                        confirmLabel="Confirm remove"
                        pendingLabel="Removing…"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pendingInvites && pendingInvites.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Pending invites
                </h3>
                <ul className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <li
                      key={invite.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
                    >
                      <span className="text-neutral-600 dark:text-neutral-300">{invite.invitee_email}</span>
                      <ConfirmActionButton
                        action={revokeInvite}
                        hiddenField={{ name: 'invite_id', value: invite.id }}
                        label="Revoke"
                        confirmLabel="Confirm revoke"
                        pendingLabel="Revoking…"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
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
        )}
      </div>
    </div>
  )
}
