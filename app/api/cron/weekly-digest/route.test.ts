import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { sendWeeklyDigests } = vi.hoisted(() => ({ sendWeeklyDigests: vi.fn() }))
vi.mock('@/lib/notifications/weekly-digest', () => ({ sendWeeklyDigests }))

import { GET } from './route'

function makeRequest(authorization?: string | null): NextRequest {
  const headers: Record<string, string> = {}
  if (authorization !== null) {
    headers.authorization = authorization ?? 'Bearer correct-secret'
  }
  return new NextRequest('http://localhost/api/cron/weekly-digest', { headers })
}

describe('GET /api/cron/weekly-digest', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.CRON_SECRET = 'correct-secret'
    sendWeeklyDigests.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('authorizes a request bearing the correct CRON_SECRET and sends digests', async () => {
    sendWeeklyDigests.mockResolvedValue([{ profileId: 'profile-a', sent: true, error: null }])

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ total: 1, sent: 1, failed: 0, results: expect.any(Array) })
    expect(sendWeeklyDigests).toHaveBeenCalledTimes(1)
  })

  it('rejects a request with a missing Authorization header before sending anything', async () => {
    const response = await GET(makeRequest(null))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(sendWeeklyDigests).not.toHaveBeenCalled()
  })

  it('rejects a request with an incorrect bearer token before sending anything', async () => {
    const response = await GET(makeRequest('Bearer wrong-secret'))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(sendWeeklyDigests).not.toHaveBeenCalled()
  })

  it('rejects every request when CRON_SECRET is not configured, even with a matching header', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(makeRequest('Bearer correct-secret'))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(sendWeeklyDigests).not.toHaveBeenCalled()
  })

  it('reports per-profile failures without failing the overall request', async () => {
    sendWeeklyDigests.mockResolvedValue([
      { profileId: 'profile-a', sent: true, error: null },
      { profileId: 'profile-b', sent: false, error: 'No email on file' },
    ])

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ total: 2, sent: 1, failed: 1, results: expect.any(Array) })
  })
})
