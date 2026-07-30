import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { getUserById, createAdminClient } = vi.hoisted(() => ({
  getUserById: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { sendOverdueCheckinReminders } from './check-in-reminder'

type Profile = { id: string }

// Two tables are queried: `profiles` (filtered by field + reminder opt-in)
// and, per profile, `manual_checkins` (latest submission date). Dispatches
// on table name since the two chains shape differently.
function makeDb(profiles: Profile[] | null, latestByProfile: Record<string, string | null> = {}, profilesError: unknown = null) {
  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      const eq = vi.fn().mockResolvedValue({ data: profiles, error: profilesError })
      const neq = vi.fn(() => ({ eq }))
      const select = vi.fn(() => ({ neq }))
      return { select }
    }
    if (table === 'manual_checkins') {
      const select = vi.fn((_cols: string) => ({
        eq: vi.fn((_col: string, profileId: string) => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: latestByProfile[profileId] ? { created_at: latestByProfile[profileId] } : null,
                error: null,
              }),
            })),
          })),
        })),
      }))
      return { select }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  return { from, auth: { admin: { getUserById } } }
}

describe('sendOverdueCheckinReminders', () => {
  const originalEnv = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'test-key'
    process.env.SENDGRID_FROM_EMAIL = 'alerts@beacon.test'
    getUserById.mockReset()
    getUserById.mockResolvedValue({ data: { user: { email: 'founder@example.com' } }, error: null })
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

    const results = await sendOverdueCheckinReminders('https://app.beacon.test')

    expect(results).toEqual([])
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('only queries profiles opted into reminders, excluding Finance', async () => {
    const db = makeDb([{ id: 'profile-1' }], { 'profile-1': null })
    createAdminClient.mockReturnValue(db)

    await sendOverdueCheckinReminders('https://app.beacon.test')

    const profilesFromCall = db.from.mock.results.find((_r, i) => db.from.mock.calls[i][0] === 'profiles')
    expect(profilesFromCall).toBeDefined()
    const select = (profilesFromCall!.value as { select: ReturnType<typeof vi.fn> }).select
    const neqResult = select.mock.results[0].value.neq
    expect(neqResult).toHaveBeenCalledWith('field', 'finance')
    const eqResult = neqResult.mock.results[0].value.eq
    expect(eqResult).toHaveBeenCalledWith('check_in_reminder_enabled', true)
  })

  it('sends a reminder to a profile with no prior check-in', async () => {
    const db = makeDb([{ id: 'profile-1' }], { 'profile-1': null })
    createAdminClient.mockReturnValue(db)

    const results = await sendOverdueCheckinReminders('https://app.beacon.test')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
    const body = JSON.parse(init.body)
    expect(body.personalizations[0].to[0].email).toBe('founder@example.com')
    expect(results).toEqual([{ profileId: 'profile-1', sent: true, error: null }])
  })

  it('does not send when the latest check-in is within the reminder interval', async () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const db = makeDb([{ id: 'profile-1' }], { 'profile-1': recent })
    createAdminClient.mockReturnValue(db)

    const results = await sendOverdueCheckinReminders('https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(results).toEqual([{ profileId: 'profile-1', sent: false, error: null }])
  })

  it('sends when the latest check-in is older than the reminder interval', async () => {
    const stale = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const db = makeDb([{ id: 'profile-1' }], { 'profile-1': stale })
    createAdminClient.mockReturnValue(db)

    const results = await sendOverdueCheckinReminders('https://app.beacon.test')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results).toEqual([{ profileId: 'profile-1', sent: true, error: null }])
  })

  it('skips a profile with no email on file and does not send', async () => {
    const db = makeDb([{ id: 'profile-1' }], { 'profile-1': null })
    createAdminClient.mockReturnValue(db)
    getUserById.mockResolvedValue({ data: { user: null }, error: null })

    const results = await sendOverdueCheckinReminders('https://app.beacon.test')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(results).toEqual([{ profileId: 'profile-1', sent: false, error: 'No email on file' }])
  })

  it('throws when the profiles query itself errors', async () => {
    const db = makeDb(null, {}, { message: 'db is down' })
    createAdminClient.mockReturnValue(db)

    await expect(sendOverdueCheckinReminders('https://app.beacon.test')).rejects.toEqual({ message: 'db is down' })
  })
})
