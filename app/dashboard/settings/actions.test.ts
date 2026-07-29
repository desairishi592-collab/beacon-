import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentSession, revalidatePath, getRequestOrigin, sendTeamInviteEmail, removeTeamMemberRow, leaveTeamRow } =
  vi.hoisted(() => ({
    getCurrentSession: vi.fn(),
    revalidatePath: vi.fn(),
    getRequestOrigin: vi.fn(),
    sendTeamInviteEmail: vi.fn(),
    removeTeamMemberRow: vi.fn(),
    leaveTeamRow: vi.fn(),
  }))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))
vi.mock('@/lib/request-origin', () => ({ getRequestOrigin }))
vi.mock('@/lib/notifications/team-invite-email', () => ({ sendTeamInviteEmail }))
vi.mock('@/lib/team-invites', () => ({
  removeTeamMember: removeTeamMemberRow,
  leaveTeam: leaveTeamRow,
}))

import { updateProfile, inviteTeamMember, revokeInvite, removeTeamMember, leaveTeam } from './actions'

function makeFormData(fields: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

function validFields(overrides: Record<string, string> = {}) {
  return {
    name: 'Ada Lovelace',
    role: 'Founder',
    team_size: '5',
    ...overrides,
  }
}

describe('updateProfile', () => {
  let eq: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    eq = vi.fn().mockResolvedValue({ error: null })
    update = vi.fn(() => ({ eq }))
    from = vi.fn(() => ({ update }))
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    revalidatePath.mockClear()
  })

  it('writes valid profile fields without touching field, and reports success', async () => {
    const formData = makeFormData(validFields())

    const result = await updateProfile(undefined, formData)

    expect(result).toEqual({ success: true })
    expect(from).toHaveBeenCalledWith('profiles')
    expect(update).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      role: 'Founder',
      team_size: 5,
    })
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('rejects a missing name before hitting the DB', async () => {
    const formData = makeFormData(validFields({ name: '' }))

    const result = await updateProfile(undefined, formData)

    expect(result).toEqual({ error: 'Name is required.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only name before hitting the DB', async () => {
    const formData = makeFormData(validFields({ name: '   ' }))

    const result = await updateProfile(undefined, formData)

    expect(result).toEqual({ error: 'Name is required.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing role before hitting the DB', async () => {
    const formData = makeFormData(validFields({ role: '' }))

    const result = await updateProfile(undefined, formData)

    expect(result).toEqual({ error: 'Position/role is required.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing team_size before hitting the DB', async () => {
    const formData = makeFormData(validFields({ team_size: '' }))

    const result = await updateProfile(undefined, formData)

    expect(result).toEqual({ error: 'Team size must be a whole number of at least 1.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a team_size below 1 before hitting the DB', async () => {
    const formData = makeFormData(validFields({ team_size: '0' }))

    const result = await updateProfile(undefined, formData)

    expect(result).toEqual({ error: 'Team size must be a whole number of at least 1.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)
    const formData = makeFormData(validFields())

    const result = await updateProfile(undefined, formData)

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a DB error', async () => {
    eq.mockResolvedValue({ error: { message: 'db is down' } })
    const formData = makeFormData(validFields())

    const result = await updateProfile(undefined, formData)

    expect(result).toEqual({ error: 'db is down' })
  })
})

describe('inviteTeamMember', () => {
  let profileMaybeSingle: ReturnType<typeof vi.fn>
  let insertSingle: ReturnType<typeof vi.fn>
  let insertSelect: ReturnType<typeof vi.fn>
  let insert: ReturnType<typeof vi.fn>
  let deleteEq: ReturnType<typeof vi.fn>
  let del: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  function makeInviteFormData(email: string) {
    const formData = new FormData()
    formData.set('email', email)
    return formData
  }

  beforeEach(() => {
    profileMaybeSingle = vi.fn().mockResolvedValue({ data: { name: 'Ada Lovelace', team_role: 'admin' } })
    insertSingle = vi.fn().mockResolvedValue({ data: { id: 'invite-1' }, error: null })
    insertSelect = vi.fn(() => ({ single: insertSingle }))
    insert = vi.fn(() => ({ select: insertSelect }))
    deleteEq = vi.fn().mockResolvedValue({ error: null })
    del = vi.fn(() => ({ eq: deleteEq }))

    from = vi.fn((table: string) => {
      if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: profileMaybeSingle }) }) }
      if (table === 'team_invites') return { insert, delete: del }
      throw new Error(`unexpected table ${table}`)
    })

    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    getRequestOrigin.mockReset()
    getRequestOrigin.mockResolvedValue('https://app.beacon.test')
    sendTeamInviteEmail.mockReset()
    sendTeamInviteEmail.mockResolvedValue(undefined)
    revalidatePath.mockClear()
  })

  it('creates a pending invite, emails it, and reports success', async () => {
    const formData = makeInviteFormData('NewHire@Example.com')

    const result = await inviteTeamMember(undefined, formData)

    expect(result).toEqual({ success: true, email: 'newhire@example.com' })
    expect(insert).toHaveBeenCalledWith({
      inviter_profile_id: 'user-1',
      invitee_email: 'newhire@example.com',
    })
    expect(sendTeamInviteEmail).toHaveBeenCalledWith({
      inviteId: 'invite-1',
      inviteeEmail: 'newhire@example.com',
      inviterName: 'Ada Lovelace',
      origin: 'https://app.beacon.test',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings')
  })

  it('rejects an invalid email before hitting the DB', async () => {
    const formData = makeInviteFormData('not-an-email')

    const result = await inviteTeamMember(undefined, formData)

    expect(result).toEqual({ error: 'Enter a valid email address.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a non-admin before creating an invite', async () => {
    profileMaybeSingle.mockResolvedValue({ data: { name: 'Bob Member', team_role: 'member' } })
    const formData = makeInviteFormData('newhire@example.com')

    const result = await inviteTeamMember(undefined, formData)

    expect(result).toEqual({ error: 'Only a team admin can invite new members.' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)
    const formData = makeInviteFormData('newhire@example.com')

    const result = await inviteTeamMember(undefined, formData)

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a DB error from the insert', async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: 'db is down' } })
    const formData = makeInviteFormData('newhire@example.com')

    const result = await inviteTeamMember(undefined, formData)

    expect(result).toEqual({ error: 'db is down' })
    expect(sendTeamInviteEmail).not.toHaveBeenCalled()
  })

  it('rolls back the invite row and reports an error when the email fails to send', async () => {
    sendTeamInviteEmail.mockRejectedValue(new Error('SendGrid down'))
    const formData = makeInviteFormData('newhire@example.com')

    const result = await inviteTeamMember(undefined, formData)

    expect(result).toEqual({ error: 'Could not send the invite email. Please try again.' })
    expect(del).toHaveBeenCalled()
    expect(deleteEq).toHaveBeenCalledWith('id', 'invite-1')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('revokeInvite', () => {
  let select: ReturnType<typeof vi.fn>
  let eqInviter: ReturnType<typeof vi.fn>
  let eqId: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  function makeFormData(inviteId: string) {
    const formData = new FormData()
    formData.set('invite_id', inviteId)
    return formData
  }

  beforeEach(() => {
    select = vi.fn().mockResolvedValue({ data: [{ id: 'invite-1' }], error: null })
    eqInviter = vi.fn(() => ({ select }))
    eqId = vi.fn(() => ({ eq: eqInviter }))
    update = vi.fn(() => ({ eq: eqId }))
    from = vi.fn(() => ({ update }))

    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    revalidatePath.mockClear()
  })

  it('revokes a pending invite and reports success', async () => {
    const result = await revokeInvite(undefined, makeFormData('invite-1'))

    expect(result).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({ status: 'revoked' })
    expect(eqId).toHaveBeenCalledWith('id', 'invite-1')
    expect(eqInviter).toHaveBeenCalledWith('inviter_profile_id', 'user-1')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings')
  })

  it('rejects a missing invite id before hitting the DB', async () => {
    const result = await revokeInvite(undefined, makeFormData(''))

    expect(result).toEqual({ error: 'Missing invite.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('reports not found when RLS blocks the update (not the inviter, or already resolved)', async () => {
    select.mockResolvedValue({ data: [], error: null })

    const result = await revokeInvite(undefined, makeFormData('invite-1'))

    expect(result).toEqual({ error: 'Invite not found or already resolved.' })
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await revokeInvite(undefined, makeFormData('invite-1'))

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(from).not.toHaveBeenCalled()
  })
})

describe('removeTeamMember', () => {
  function makeFormData(memberId: string) {
    const formData = new FormData()
    formData.set('member_id', memberId)
    return formData
  }

  beforeEach(() => {
    removeTeamMemberRow.mockReset()
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'admin-1', db: {} })
    revalidatePath.mockClear()
  })

  it('removes a teammate and reports success', async () => {
    removeTeamMemberRow.mockResolvedValue(undefined)

    const result = await removeTeamMember(undefined, makeFormData('member-1'))

    expect(result).toEqual({ success: true })
    expect(removeTeamMemberRow).toHaveBeenCalledWith('admin-1', 'member-1')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/team')
  })

  it('surfaces a not_admin error', async () => {
    removeTeamMemberRow.mockResolvedValue('not_admin')

    const result = await removeTeamMember(undefined, makeFormData('member-1'))

    expect(result).toEqual({ error: 'Only a team admin can remove members.' })
  })

  it('rejects a missing member id before calling the helper', async () => {
    const result = await removeTeamMember(undefined, makeFormData(''))

    expect(result).toEqual({ error: 'Missing team member.' })
    expect(removeTeamMemberRow).not.toHaveBeenCalled()
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await removeTeamMember(undefined, makeFormData('member-1'))

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(removeTeamMemberRow).not.toHaveBeenCalled()
  })
})

describe('leaveTeam', () => {
  beforeEach(() => {
    leaveTeamRow.mockReset()
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'member-1', db: {} })
    revalidatePath.mockClear()
  })

  it('leaves the team and reports success', async () => {
    leaveTeamRow.mockResolvedValue(undefined)

    const result = await leaveTeam(undefined, new FormData())

    expect(result).toEqual({ success: true })
    expect(leaveTeamRow).toHaveBeenCalledWith('member-1')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('blocks an admin from leaving their own team', async () => {
    leaveTeamRow.mockResolvedValue('is_admin')

    const result = await leaveTeam(undefined, new FormData())

    expect(result).toEqual({ error: 'Team admins can’t leave their team.' })
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await leaveTeam(undefined, new FormData())

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(leaveTeamRow).not.toHaveBeenCalled()
  })
})
