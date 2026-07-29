import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { ConfirmActionButton } from '../_components/confirm-action-button'
import { InviteTeamMemberButton } from './invite-team-member-button'
import { revokeInvite, removeTeamMember } from './actions'

// Admin-only: rendering is gated behind the nav link, but that's not a
// security boundary (see AGENTS.md / node_modules/next/dist/docs server
// actions guide — a route is reachable to anyone who requests it
// directly), so team_role is re-checked here regardless of how the user
// arrived.
export default async function OrganizationPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')
  const { userId, db } = session

  const { data: profile } = await db
    .from('profiles')
    .select('team_id, team_role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) redirect('/onboarding')
  if (profile.team_role !== 'admin') redirect('/dashboard/settings')

  const [{ data: teamMembers }, { data: pendingInvites }] = await Promise.all([
    db
      .from('profiles')
      .select('id, name, role, team_role')
      .eq('team_id', profile.team_id)
      .neq('id', userId)
      .order('name', { ascending: true }),
    db
      .from('team_invites')
      .select('id, invitee_email, created_at')
      .eq('inviter_profile_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Manage who&apos;s on your team and their access.
        </p>
      </div>

      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-medium">Invite a team member</h2>
        <p className="mt-1 mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          As the team admin, you can see teammates&apos; check-ins on the{' '}
          <a href="/dashboard/team" className="underline">
            Team
          </a>{' '}
          page.
        </p>
        <InviteTeamMemberButton />
      </div>

      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-medium">Members</h2>

        {teamMembers && teamMembers.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {teamMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
              >
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{member.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {member.team_role}
                  </span>
                  <ConfirmActionButton
                    action={removeTeamMember}
                    hiddenField={{ name: 'member_id', value: member.id }}
                    label="Remove"
                    confirmLabel="Confirm remove"
                    pendingLabel="Removing…"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            No team members yet. Invite someone above to get started.
          </p>
        )}
      </div>

      {pendingInvites && pendingInvites.length > 0 && (
        <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-medium">Pending invites</h2>
          <ul className="mt-4 space-y-2">
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
    </div>
  )
}
