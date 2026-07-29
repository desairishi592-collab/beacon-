import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getUserById = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { getUserById } },
  })),
}))

import { notifySevereCheckin } from './check-in-email'

describe('notifySevereCheckin', () => {
  const originalEnv = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'test-key'
    process.env.SENDGRID_FROM_EMAIL = 'alerts@beacon.test'
    getUserById.mockReset()
    getUserById.mockResolvedValue({ data: { user: { email: 'founder@example.com' } }, error: null })
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends an email when a response is rated Significant/Severe (4-5)', async () => {
    const checkin = {
      profileId: 'profile-1',
      responses: { patient_safety: 5, staffing: 2, compliance: 1, supply: 1 },
      notes: 'Short-staffed on nights this week.',
    }

    await notifySevereCheckin(checkin, 'https://app.beacon.test')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
    const body = JSON.parse(init.body)
    expect(body.personalizations[0].to[0].email).toBe('founder@example.com')
    expect(body.subject).toContain('1 concern')
    expect(body.content[0].value).toContain('Short-staffed on nights this week.')
  })

  it('does not send an email when all ratings are below the severe threshold (1-3)', async () => {
    const checkin = {
      profileId: 'profile-1',
      responses: { patient_safety: 3, staffing: 2, compliance: 1, supply: 3 },
      notes: null,
    }

    await notifySevereCheckin(checkin, 'https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('logs the failure instead of throwing when the SendGrid call fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'internal error' })
    const checkin = {
      profileId: 'profile-1',
      responses: { patient_safety: 4, staffing: 1, compliance: 1, supply: 1 },
      notes: null,
    }

    await expect(notifySevereCheckin(checkin, 'https://app.beacon.test')).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledTimes(1)
    const [message, error] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(message).toContain('Check-in severity notification email failed for profile profile-1')
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('SendGrid send failed with status 500')
  })

  it('logs the failure instead of throwing when fetch itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const checkin = {
      profileId: 'profile-1',
      responses: { patient_safety: 5, staffing: 1, compliance: 1, supply: 1 },
      notes: null,
    }

    await expect(notifySevereCheckin(checkin, 'https://app.beacon.test')).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalledTimes(1)
    const [, error] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]
    expect((error as Error).message).toBe('network down')
  })

  it('does not send an email when SendGrid env vars are missing', async () => {
    delete process.env.SENDGRID_FROM_EMAIL
    const checkin = {
      profileId: 'profile-1',
      responses: { patient_safety: 5, staffing: 1, compliance: 1, supply: 1 },
      notes: null,
    }

    await notifySevereCheckin(checkin, 'https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send an email when the user lookup fails', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: null })
    const checkin = {
      profileId: 'profile-1',
      responses: { patient_safety: 5, staffing: 1, compliance: 1, supply: 1 },
      notes: null,
    }

    await notifySevereCheckin(checkin, 'https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
