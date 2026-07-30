import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, getCurrentSession, resolveInvite } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
  getCurrentSession: vi.fn(),
  resolveInvite: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))
vi.mock('@/lib/team-invites', () => ({ resolveInvite }))

import { completeOnboarding } from './actions'

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
    company_name: 'Acme Inc.',
    role: 'Founder',
    field: 'engineering',
    wants_data_integration: 'yes',
    ...overrides,
  }
}

describe('completeOnboarding', () => {
  let upsert: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    upsert = vi.fn().mockResolvedValue({ error: null })
    from = vi.fn(() => ({ upsert }))
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    redirectMock.mockClear()
  })

  it('writes valid, complete data to the profiles table and redirects to the data connection flow when yes', async () => {
    const formData = makeFormData(validFields())

    await expect(completeOnboarding(undefined, formData)).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/settings/integrations'
    )

    expect(from).toHaveBeenCalledWith('profiles')
    expect(upsert).toHaveBeenCalledWith({
      id: 'user-1',
      name: 'Ada Lovelace',
      company_name: 'Acme Inc.',
      role: 'Founder',
      field: 'engineering',
      team_size: 1,
      wants_data_integration: true,
    })
  })

  it('redirects to the dashboard when the answer is no', async () => {
    const formData = makeFormData(validFields({ wants_data_integration: 'no' }))

    await expect(completeOnboarding(undefined, formData)).rejects.toThrow('NEXT_REDIRECT:/dashboard')

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ wants_data_integration: false })
    )
  })

  it('rejects a missing name before hitting the DB', async () => {
    const formData = makeFormData(validFields({ name: '' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Name is required.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only name before hitting the DB', async () => {
    const formData = makeFormData(validFields({ name: '   ' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Name is required.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing company name before hitting the DB', async () => {
    const formData = makeFormData(validFields({ company_name: '' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Company name is required.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only company name before hitting the DB', async () => {
    const formData = makeFormData(validFields({ company_name: '   ' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Company name is required.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing role before hitting the DB', async () => {
    const formData = makeFormData(validFields({ role: '' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Position/role is required.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing field value before hitting the DB', async () => {
    const formData = makeFormData(validFields({ field: '' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Please select a field.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a field value that is not one of finance/engineering/medicine/other before hitting the DB', async () => {
    const formData = makeFormData(validFields({ field: 'marketing' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Please select a field.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing wants_data_integration answer before hitting the DB', async () => {
    const formData = makeFormData(validFields({ wants_data_integration: '' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Let us know if we can integrate with your database/systems.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a wants_data_integration value that is not yes/no before hitting the DB', async () => {
    const formData = makeFormData(validFields({ wants_data_integration: 'maybe' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Let us know if we can integrate with your database/systems.')
    expect(from).not.toHaveBeenCalled()
  })
})

describe('completeOnboarding with an invite', () => {
  let upsert: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>
  let getUser: ReturnType<typeof vi.fn>

  beforeEach(() => {
    upsert = vi.fn().mockResolvedValue({ error: null })
    from = vi.fn(() => ({ upsert }))
    getUser = vi.fn().mockResolvedValue({ data: { user: { email: 'newhire@example.com' } } })
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from, auth: { getUser } } })
    resolveInvite.mockReset()
    resolveInvite.mockResolvedValue({ teamId: 'team-abc', role: 'member' })
    redirectMock.mockClear()
  })

  it('resolves the invite and joins the inviter team_id with the assigned role', async () => {
    const formData = makeFormData(validFields({ invite: 'invite-1' }))

    await expect(completeOnboarding(undefined, formData)).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/settings/integrations'
    )

    expect(resolveInvite).toHaveBeenCalledWith('invite-1', 'newhire@example.com')
    expect(upsert).toHaveBeenCalledWith({
      id: 'user-1',
      name: 'Ada Lovelace',
      company_name: 'Acme Inc.',
      role: 'Founder',
      field: 'engineering',
      team_size: 1,
      wants_data_integration: true,
      team_id: 'team-abc',
      team_role: 'member',
    })
  })

  it('joins as an admin when the inviting admin assigned the admin role', async () => {
    resolveInvite.mockResolvedValue({ teamId: 'team-abc', role: 'admin' })
    const formData = makeFormData(validFields({ invite: 'invite-1' }))

    await expect(completeOnboarding(undefined, formData)).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/settings/integrations'
    )

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: 'team-abc', team_role: 'admin' })
    )
  })

  it('completes onboarding without a team_id or team_role when the invite does not resolve', async () => {
    resolveInvite.mockResolvedValue(undefined)
    const formData = makeFormData(validFields({ invite: 'stale-invite' }))

    await expect(completeOnboarding(undefined, formData)).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/settings/integrations'
    )

    expect(upsert).toHaveBeenCalledWith({
      id: 'user-1',
      name: 'Ada Lovelace',
      company_name: 'Acme Inc.',
      role: 'Founder',
      field: 'engineering',
      team_size: 1,
      wants_data_integration: true,
    })
  })

  it('does not attempt to resolve an invite when no invite is present', async () => {
    const formData = makeFormData(validFields())

    await expect(completeOnboarding(undefined, formData)).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/settings/integrations'
    )

    expect(resolveInvite).not.toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
  })
})
