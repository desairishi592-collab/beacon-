import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { resolveInvite, removeTeamMember, leaveTeam } from './team-invites'

describe('resolveInvite', () => {
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
        role: 'member',
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

  it('returns the inviter team_id and role, and marks the invite accepted for a matching pending invite', async () => {
    const resolved = await resolveInvite('invite-1', 'newhire@example.com')

    expect(resolved).toEqual({ teamId: 'team-abc', role: 'member' })
    expect(update).toHaveBeenCalledWith({ status: 'accepted' })
    expect(updateEq).toHaveBeenCalledWith('id', 'invite-1')
  })

  it('matches the invitee email case-insensitively', async () => {
    const resolved = await resolveInvite('invite-1', 'NewHire@Example.com')

    expect(resolved).toEqual({ teamId: 'team-abc', role: 'member' })
  })

  it('returns the invite role when the admin invited someone as an admin', async () => {
    inviteMaybeSingle.mockResolvedValue({
      data: {
        id: 'invite-1',
        inviter_profile_id: 'inviter-1',
        invitee_email: 'newhire@example.com',
        status: 'pending',
        role: 'admin',
      },
    })

    const resolved = await resolveInvite('invite-1', 'newhire@example.com')

    expect(resolved).toEqual({ teamId: 'team-abc', role: 'admin' })
  })

  it('returns undefined and does not mutate the invite when the invite does not exist', async () => {
    inviteMaybeSingle.mockResolvedValue({ data: null })

    const resolved = await resolveInvite('missing', 'newhire@example.com')

    expect(resolved).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })

  it('returns undefined when the invite is already accepted', async () => {
    inviteMaybeSingle.mockResolvedValue({
      data: {
        id: 'invite-1',
        inviter_profile_id: 'inviter-1',
        invitee_email: 'newhire@example.com',
        status: 'accepted',
        role: 'member',
      },
    })

    const resolved = await resolveInvite('invite-1', 'newhire@example.com')

    expect(resolved).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })

  it('returns undefined when the signup email does not match the invited email', async () => {
    const resolved = await resolveInvite('invite-1', 'someoneelse@example.com')

    expect(resolved).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })

  it('returns undefined when the inviter profile no longer exists', async () => {
    profileMaybeSingle.mockResolvedValue({ data: null })

    const resolved = await resolveInvite('invite-1', 'newhire@example.com')

    expect(resolved).toBeUndefined()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('removeTeamMember', () => {
  let profilesMaybeSingle: ReturnType<typeof vi.fn>
  let profilesSelectEq: ReturnType<typeof vi.fn>
  let profilesSelect: ReturnType<typeof vi.fn>
  let updateEq: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    profilesMaybeSingle = vi.fn()
    profilesSelectEq = vi.fn(() => ({ maybeSingle: profilesMaybeSingle }))
    profilesSelect = vi.fn(() => ({ eq: profilesSelectEq }))
    updateEq = vi.fn().mockResolvedValue({ error: null })
    update = vi.fn(() => ({ eq: updateEq }))

    from = vi.fn((table: string) => {
      if (table === 'profiles') return { select: profilesSelect, update }
      throw new Error(`unexpected table ${table}`)
    })

    createAdminClient.mockReturnValue({ from })
  })

  it('resets the member to a fresh solo team when the caller is the team admin', async () => {
    profilesMaybeSingle
      .mockResolvedValueOnce({ data: { team_id: 'team-abc', team_role: 'admin' } })
      .mockResolvedValueOnce({ data: { team_id: 'team-abc' } })

    const result = await removeTeamMember('admin-1', 'member-1')

    expect(result).toBeUndefined()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ team_role: 'admin', team_id: expect.any(String) })
    )
    expect(updateEq).toHaveBeenCalledWith('id', 'member-1')
  })

  it('rejects removing yourself', async () => {
    const result = await removeTeamMember('user-1', 'user-1')

    expect(result).toBe('not_admin')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects when the caller is not an admin', async () => {
    profilesMaybeSingle.mockResolvedValueOnce({ data: { team_id: 'team-abc', team_role: 'member' } })

    const result = await removeTeamMember('admin-1', 'member-1')

    expect(result).toBe('not_admin')
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects when the target profile does not exist', async () => {
    profilesMaybeSingle
      .mockResolvedValueOnce({ data: { team_id: 'team-abc', team_role: 'admin' } })
      .mockResolvedValueOnce({ data: null })

    const result = await removeTeamMember('admin-1', 'member-1')

    expect(result).toBe('not_found')
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects when the target is on a different team', async () => {
    profilesMaybeSingle
      .mockResolvedValueOnce({ data: { team_id: 'team-abc', team_role: 'admin' } })
      .mockResolvedValueOnce({ data: { team_id: 'team-xyz' } })

    const result = await removeTeamMember('admin-1', 'member-1')

    expect(result).toBe('not_teammate')
    expect(update).not.toHaveBeenCalled()
  })
})

describe('leaveTeam', () => {
  let profilesMaybeSingle: ReturnType<typeof vi.fn>
  let profilesSelectEq: ReturnType<typeof vi.fn>
  let profilesSelect: ReturnType<typeof vi.fn>
  let updateEq: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    profilesMaybeSingle = vi.fn()
    profilesSelectEq = vi.fn(() => ({ maybeSingle: profilesMaybeSingle }))
    profilesSelect = vi.fn(() => ({ eq: profilesSelectEq }))
    updateEq = vi.fn().mockResolvedValue({ error: null })
    update = vi.fn(() => ({ eq: updateEq }))

    from = vi.fn((table: string) => {
      if (table === 'profiles') return { select: profilesSelect, update }
      throw new Error(`unexpected table ${table}`)
    })

    createAdminClient.mockReturnValue({ from })
  })

  it('resets a member to a fresh solo team', async () => {
    profilesMaybeSingle.mockResolvedValue({ data: { team_role: 'member' } })

    const result = await leaveTeam('member-1')

    expect(result).toBeUndefined()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ team_role: 'admin', team_id: expect.any(String) })
    )
    expect(updateEq).toHaveBeenCalledWith('id', 'member-1')
  })

  it('rejects when the profile no longer exists', async () => {
    profilesMaybeSingle.mockResolvedValue({ data: null })

    const result = await leaveTeam('member-1')

    expect(result).toBe('not_found')
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects an admin trying to leave their own team', async () => {
    profilesMaybeSingle.mockResolvedValue({ data: { team_role: 'admin' } })

    const result = await leaveTeam('admin-1')

    expect(result).toBe('is_admin')
    expect(update).not.toHaveBeenCalled()
  })
})
