import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RiskFlag, RiskSeverity } from '@/lib/supabase/types'

vi.mock('server-only', () => ({}))

const getUserById = vi.fn()
const preferencesSelect = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { getUserById } },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: preferencesSelect })) })),
  })),
}))

import { notifyNewRiskFlags } from './risk-flag-email'

function makeFlag(overrides: Partial<RiskFlag> = {}): RiskFlag {
  return {
    id: 'flag-1',
    snapshot_id: 'snap-1',
    profile_id: 'profile-1',
    signal_type: 'cash_runway',
    severity: 'critical',
    metric_value: 0,
    threshold_value: null,
    metric_label: 'Cash runway',
    title: 'Cash runway critically low',
    explanation: 'Cash will run out within days.',
    recommendation: 'Raise financing immediately.',
    raw_signal: {},
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

describe('notifyNewRiskFlags', () => {
  const originalEnv = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'test-key'
    process.env.SENDGRID_FROM_EMAIL = 'alerts@beacon.test'
    getUserById.mockReset()
    getUserById.mockResolvedValue({ data: { user: { email: 'founder@example.com' } }, error: null })
    preferencesSelect.mockReset()
    preferencesSelect.mockResolvedValue({ data: [], error: null })
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends an email when a critical/high severity flag is present', async () => {
    const flags = [makeFlag({ severity: 'critical' })]

    await notifyNewRiskFlags(flags, 'https://app.beacon.test')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
    const body = JSON.parse(init.body)
    expect(body.personalizations[0].to[0].email).toBe('founder@example.com')
    expect(body.subject).toContain('1 urgent risk flag')
  })

  it('sends an email when at least one of several flags is urgent, even if others are not', async () => {
    const flags = [makeFlag({ id: 'flag-low', severity: 'low' }), makeFlag({ id: 'flag-high', severity: 'high' })]

    await notifyNewRiskFlags(flags, 'https://app.beacon.test')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each<RiskSeverity>(['low', 'medium'])('does not send an email when all flags are %s severity', async (severity) => {
    const flags = [makeFlag({ severity })]

    await notifyNewRiskFlags(flags, 'https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('does not send an email when the only urgent flag type has email disabled', async () => {
    preferencesSelect.mockResolvedValue({
      data: [{ signal_type: 'cash_runway', email_enabled: false }],
      error: null,
    })
    const flags = [makeFlag({ severity: 'critical', signal_type: 'cash_runway' })]

    await notifyNewRiskFlags(flags, 'https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('emails only the urgent flags whose type still has email enabled', async () => {
    preferencesSelect.mockResolvedValue({
      data: [{ signal_type: 'cash_runway', email_enabled: false }],
      error: null,
    })
    const flags = [
      makeFlag({ id: 'flag-cash', severity: 'critical', signal_type: 'cash_runway' }),
      makeFlag({ id: 'flag-burn', severity: 'high', signal_type: 'burn_rate' }),
    ]

    await notifyNewRiskFlags(flags, 'https://app.beacon.test')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.subject).toContain('1 urgent risk flag')
  })

  it('does nothing when there are no flags', async () => {
    await notifyNewRiskFlags([], 'https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs the failure instead of throwing when the SendGrid call fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'internal error' })
    const flags = [makeFlag({ severity: 'critical' })]

    await expect(notifyNewRiskFlags(flags, 'https://app.beacon.test')).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledTimes(1)
    const [message, error] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(message).toContain('Risk flag notification email failed for profile profile-1')
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('SendGrid send failed with status 500')
  })

  it('logs the failure instead of throwing when fetch itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const flags = [makeFlag({ severity: 'critical' })]

    await expect(notifyNewRiskFlags(flags, 'https://app.beacon.test')).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalledTimes(1)
    const [, error] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]
    expect((error as Error).message).toBe('network down')
  })

  it('does not send an email when SendGrid env vars are missing', async () => {
    delete process.env.SENDGRID_API_KEY
    const flags = [makeFlag({ severity: 'critical' })]

    await notifyNewRiskFlags(flags, 'https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send an email when the user lookup fails', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: null })
    const flags = [makeFlag({ severity: 'critical' })]

    await notifyNewRiskFlags(flags, 'https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
