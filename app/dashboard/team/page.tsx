import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/current-user'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import { CheckInHistory } from '../_components/check-in-history'
import type { ManualCheckin } from '@/lib/supabase/types'

// Admin-only: rendering is gated behind the nav link, but that's not a
// security boundary (see AGENTS.md / node_modules/next/dist/docs server
// actions guide — a route is reachable to anyone who requests it
// directly), so team_role is re-checked here regardless of how the user
// arrived.
export default async function TeamPage() {
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

  const { data: members } = await db
    .from('profiles')
    .select('id, name, role, field')
    .eq('team_id', profile.team_id)
    .neq('id', userId)
    .order('name', { ascending: true })

  const teamMembers = members ?? []

  const checkinsByMember = new Map<string, ManualCheckin[]>()
  await Promise.all(
    teamMembers
      .filter((member) => isManualCheckinField(member.field))
      .map(async (member) => {
        const { data: checkins } = await db
          .from('manual_checkins')
          .select('*')
          .eq('profile_id', member.id)
          .order('created_at', { ascending: false })
          .limit(5)
        checkinsByMember.set(member.id, checkins ?? [])
      })
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Recent check-ins from the teammates you&apos;ve invited. Financial data and risk flags
          stay private to each person&apos;s own account.
        </p>
      </div>

      {teamMembers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-neutral-500 dark:text-neutral-400">No team members yet.</p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-600">
            Invite teammates from Settings to see their check-ins here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {teamMembers.map((member) => {
            const checkins = checkinsByMember.get(member.id) ?? []
            return (
              <div key={member.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="text-sm font-medium">{member.name}</h2>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{member.role}</span>
                </div>

                {!isManualCheckinField(member.field) ? (
                  <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-600">
                    Finance check-ins run through QuickBooks and risk flags, which aren&apos;t shared
                    in team view.
                  </p>
                ) : checkins.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-600">
                    No check-ins submitted yet.
                  </p>
                ) : (
                  <CheckInHistory checkins={checkins} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
