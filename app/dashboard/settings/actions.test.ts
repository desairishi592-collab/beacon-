import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentSession, revalidatePath, leaveTeamRow } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
  leaveTeamRow: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))
vi.mock('@/lib/team-invites', () => ({
  leaveTeam: leaveTeamRow,
}))

import { updateProfile, leaveTeam } from './actions'

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
