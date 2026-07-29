import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentSession, revalidatePath, getRequestOrigin, sendTeamInviteEmail } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
  getRequestOrigin: vi.fn(),
  sendTeamInviteEmail: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))
vi.mock('@/lib/request-origin', () => ({ getRequestOrigin }))
vi.mock('@/lib/notifications/team-invite-email', () => ({ sendTeamInviteEmail }))

import { updateProfile, inviteTeamMember } from './actions'

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
    profileMaybeSingle = vi.fn().mockResolvedValue({ data: { name: 'Ada Lovelace' } })
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
