import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { getUserById, createAdminClient, getDashboardSummary } = vi.hoisted(() => ({
  getUserById: vi.fn(),
  createAdminClient: vi.fn(),
  getDashboardSummary: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('@/lib/dashboard/summary', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dashboard/summary')>('@/lib/dashboard/summary')
  return { ...actual, getDashboardSummary }
})

import { sendWeeklyDigests } from './weekly-digest'

function makeDb(profiles: { id: string; field: string }[] | null, profilesError: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data: profiles, error: profilesError })
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { from, auth: { admin: { getUserById } } }
}

const HEALTHY_SUMMARY = {
  riskFlagCounts: { critical: 0, high: 0, medium: 0, low: 0 },
  overallStatus: 'healthy' as const,
  lastActivityAt: null,
  lastActivityLabel: 'check-in' as const,
  urgentIndicator: null,
}

describe('sendWeeklyDigests', () => {
  const originalEnv = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'test-key'
    process.env.SENDGRID_FROM_EMAIL = 'alerts@beacon.test'
    getUserById.mockReset()
    getUserById.mockResolvedValue({ data: { user: { email: 'founder@example.com' } }, error: null })
    getDashboardSummary.mockReset()
    getDashboardSummary.mockResolvedValue(HEALTHY_SUMMARY)
    createAdminClient.mockReset()
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not query or send when SendGrid env vars are missing', async () => {
    delete process.env.SENDGRID_FROM_EMAIL

    const results = await sendWeeklyDigests('https://app.beacon.test')

    expect(results).toEqual([])
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('sends a digest to every opted-in profile using getDashboardSummary', async () => {
    const db = makeDb([{ id: 'profile-1', field: 'finance' }])
    createAdminClient.mockReturnValue(db)

    const results = await sendWeeklyDigests('https://app.beacon.test')

    expect(db.from).toHaveBeenCalledWith('profiles')
    expect(getDashboardSummary).toHaveBeenCalledWith({ userId: 'profile-1', db }, true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
    const body = JSON.parse(init.body)
    expect(body.personalizations[0].to[0].email).toBe('founder@example.com')
    expect(body.subject).toContain('Healthy')
    expect(body.content[0].value).toContain('https://app.beacon.test/dashboard')
    expect(results).toEqual([{ profileId: 'profile-1', sent: true, error: null }])
  })

  it('passes isFinance=false for a non-finance profile', async () => {
    const db = makeDb([{ id: 'profile-2', field: 'engineering' }])
    createAdminClient.mockReturnValue(db)

    await sendWeeklyDigests('https://app.beacon.test')

    expect(getDashboardSummary).toHaveBeenCalledWith({ userId: 'profile-2', db }, false)
  })

  it('skips a profile with no email on file and does not send', async () => {
    const db = makeDb([{ id: 'profile-1', field: 'finance' }])
    createAdminClient.mockReturnValue(db)
    getUserById.mockResolvedValue({ data: { user: null }, error: null })

    const results = await sendWeeklyDigests('https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(results).toEqual([{ profileId: 'profile-1', sent: false, error: 'No email on file' }])
  })

  it('logs and records the failure instead of throwing when SendGrid rejects the send', async () => {
    const db = makeDb([{ id: 'profile-1', field: 'finance' }])
    createAdminClient.mockReturnValue(db)
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'internal error' })

    const results = await sendWeeklyDigests('https://app.beacon.test')

    expect(console.error).toHaveBeenCalledTimes(1)
    expect(results[0].sent).toBe(false)
    expect(results[0].error).toContain('SendGrid send failed with status 500')
  })

  it('does not let one profile failure stop the others', async () => {
    const db = makeDb([
      { id: 'profile-1', field: 'finance' },
      { id: 'profile-2', field: 'engineering' },
    ])
    createAdminClient.mockReturnValue(db)
    getUserById.mockImplementation(async (id: string) =>
      id === 'profile-1'
        ? { data: { user: null }, error: null }
        : { data: { user: { email: 'other@example.com' } }, error: null },
    )

    const results = await sendWeeklyDigests('https://app.beacon.test')

    expect(results).toEqual([
      { profileId: 'profile-1', sent: false, error: 'No email on file' },
      { profileId: 'profile-2', sent: true, error: null },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws when the profiles query itself errors', async () => {
    const db = makeDb(null, { message: 'db is down' })
    createAdminClient.mockReturnValue(db)

    await expect(sendWeeklyDigests('https://app.beacon.test')).rejects.toEqual({ message: 'db is down' })
  })
})

describe('SCRATCH preview (temporary, will be removed)', () => {
  it('prints the rendered digest HTML for manual inspection', async () => {
    process.env.SENDGRID_API_KEY = 'test-key'
    process.env.SENDGRID_FROM_EMAIL = 'alerts@beacon.test'
    getUserById.mockResolvedValue({ data: { user: { email: 'founder@example.com' } }, error: null })
    getDashboardSummary.mockResolvedValue({
      riskFlagCounts: { critical: 1, high: 0, medium: 2, low: 1 },
      overallStatus: 'critical',
      lastActivityAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      lastActivityLabel: 'sync',
      urgentIndicator: { kind: 'cash_runway_critical', runwayMonths: 0.6, title: 'Cash runway critically low' },
    })
    const db = makeDb([{ id: 'profile-1', field: 'finance' }])
    createAdminClient.mockReturnValue(db)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)

    await sendWeeklyDigests('https://app.beacon.test')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    console.log('SUBJECT:', body.subject)
    console.log('HTML:', body.content[0].value)
  })
})
