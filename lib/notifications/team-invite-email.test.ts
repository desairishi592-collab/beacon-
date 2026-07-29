import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { sendTeamInviteEmail } from './team-invite-email'

describe('sendTeamInviteEmail', () => {
  const originalEnv = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'test-key'
    process.env.SENDGRID_FROM_EMAIL = 'alerts@beacon.test'
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends an invite email with a signup link carrying the invite id and email', async () => {
    await sendTeamInviteEmail({
      inviteId: 'invite-1',
      inviteeEmail: 'newhire@example.com',
      inviterName: 'Ada Lovelace',
      origin: 'https://app.beacon.test',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
    const body = JSON.parse(init.body)
    expect(body.personalizations[0].to[0].email).toBe('newhire@example.com')
    expect(body.subject).toContain('Ada Lovelace')
    expect(body.content[0].value).toContain('https://app.beacon.test/login?invite=invite-1&email=newhire%40example.com')
  })

  it('escapes the inviter name in the email body', async () => {
    await sendTeamInviteEmail({
      inviteId: 'invite-1',
      inviteeEmail: 'newhire@example.com',
      inviterName: '<script>alert(1)</script>',
      origin: 'https://app.beacon.test',
    })

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.content[0].value).not.toContain('<script>alert(1)</script>')
    expect(body.content[0].value).toContain('&lt;script&gt;')
  })

  it('throws when SendGrid env vars are missing', async () => {
    delete process.env.SENDGRID_FROM_EMAIL

    await expect(
      sendTeamInviteEmail({
        inviteId: 'invite-1',
        inviteeEmail: 'newhire@example.com',
        inviterName: 'Ada Lovelace',
        origin: 'https://app.beacon.test',
      })
    ).rejects.toThrow('SendGrid is not configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the SendGrid call fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'internal error' })

    await expect(
      sendTeamInviteEmail({
        inviteId: 'invite-1',
        inviteeEmail: 'newhire@example.com',
        inviterName: 'Ada Lovelace',
        origin: 'https://app.beacon.test',
      })
    ).rejects.toThrow('SendGrid send failed with status 500')
  })
})
