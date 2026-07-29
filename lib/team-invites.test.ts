import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { resolveInviteTeamId } from './team-invites'

describe('resolveInviteTeamId', () => {
  let inviteMaybeSingle: ReturnType<typeof vi.fn>
  let profileMaybeSingle: ReturnType<typeof vi.fn>
  let updateEq: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    inviteMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'invite-1',
        inviter_profile_id: 'inviter-1',
        invitee_email: 'newhire@example.com',
        status: 'pending',
      },
    })
    profileMaybeSingle = vi.fn().mockResolvedValue({ data: { team_id: 'team-abc' } })
    updateEq = vi.fn().mockResolvedValue({ error: null })
    update = vi.fn(() => ({ eq: updateEq }))

    from = vi.fn((table: string) => {
      if (table === 'team_invites') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: inviteMaybeSingle }) }),
          update,
        }
      }
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: profileMaybeSingle }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    })

    createAdminClient.mockReturnValue({ from })
  })

  it('returns the inviter team_id and marks the invite accepted for a matching pending invite', async () => {
    const teamId = await resolveInviteTeamId('invite-1', 'newhire@example.com')

    expect(teamId).toBe('team-abc')
    expect(update).toHaveBeenCalledWith({ status: 'accepted' })
    expect(updateEq).toHaveBeenCalledWith('id', 'invite-1')
  })

  it('matches the invitee email case-insensitively', async () => {
    const teamId = await resolveInviteTeamId('invite-1', 'NewHire@Example.com')

    expect(teamId).toBe('team-abc')
  })

  it('returns undefined and does not mutate the invite when the invite does not exist', async () => {
    inviteMaybeSingle.mockResolvedValue({ data: null })

    const teamId = await resolveInviteTeamId('missing', 'newhire@example.com')

    expect(teamId).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })

  it('returns undefined when the invite is already accepted', async () => {
    inviteMaybeSingle.mockResolvedValue({
      data: {
        id: 'invite-1',
        inviter_profile_id: 'inviter-1',
        invitee_email: 'newhire@example.com',
        status: 'accepted',
      },
    })

    const teamId = await resolveInviteTeamId('invite-1', 'newhire@example.com')

    expect(teamId).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })

  it('returns undefined when the signup email does not match the invited email', async () => {
    const teamId = await resolveInviteTeamId('invite-1', 'someoneelse@example.com')

    expect(teamId).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })

  it('returns undefined when the inviter profile no longer exists', async () => {
    profileMaybeSingle.mockResolvedValue({ data: null })

    const teamId = await resolveInviteTeamId('invite-1', 'newhire@example.com')

    expect(teamId).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })
})
