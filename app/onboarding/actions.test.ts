import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, getCurrentSession } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
  getCurrentSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))

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
    role: 'Founder',
    field: 'engineering',
    team_size: '5',
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

  it('writes valid, complete data to the profiles table and redirects to the dashboard', async () => {
    const formData = makeFormData(validFields())

    await expect(completeOnboarding(undefined, formData)).rejects.toThrow('NEXT_REDIRECT:/dashboard')

    expect(from).toHaveBeenCalledWith('profiles')
    expect(upsert).toHaveBeenCalledWith({
      id: 'user-1',
      name: 'Ada Lovelace',
      role: 'Founder',
      field: 'engineering',
      team_size: 5,
    })
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

  it('rejects a missing role before hitting the DB', async () => {
    const formData = makeFormData(validFields({ role: '' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Position/role is required.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing team_size before hitting the DB', async () => {
    const formData = makeFormData(validFields({ team_size: '' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Team size must be a whole number of at least 1.')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a team_size below 1 before hitting the DB', async () => {
    const formData = makeFormData(validFields({ team_size: '0' }))

    const result = await completeOnboarding(undefined, formData)

    expect(result?.error).toBe('Team size must be a whole number of at least 1.')
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
})
