import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { syncAllQuickbooksConnections } = vi.hoisted(() => ({ syncAllQuickbooksConnections: vi.fn() }))
vi.mock('@/lib/quickbooks/sync', () => ({ syncAllQuickbooksConnections }))

import { GET } from './route'

function makeRequest(authorization?: string | null): NextRequest {
  const headers: Record<string, string> = {}
  if (authorization !== null) {
    headers.authorization = authorization ?? 'Bearer correct-secret'
  }
  return new NextRequest('http://localhost/api/cron/quickbooks-sync', { headers })
}

describe('GET /api/cron/quickbooks-sync', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.CRON_SECRET = 'correct-secret'
    syncAllQuickbooksConnections.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('authorizes a request bearing the correct CRON_SECRET and runs the sync', async () => {
    syncAllQuickbooksConnections.mockResolvedValue([
      { profileId: 'profile-a', result: { snapshotsSynced: 1, latestSnapshotId: 'snap-1' }, error: null },
    ])

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ total: 1, succeeded: 1, failed: 0, results: expect.any(Array) })
    expect(syncAllQuickbooksConnections).toHaveBeenCalledTimes(1)
  })

  it('rejects a request with a missing Authorization header before running any sync', async () => {
    const response = await GET(makeRequest(null))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(syncAllQuickbooksConnections).not.toHaveBeenCalled()
  })

  it('rejects a request with an incorrect bearer token before running any sync', async () => {
    const response = await GET(makeRequest('Bearer wrong-secret'))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(syncAllQuickbooksConnections).not.toHaveBeenCalled()
  })

  it('rejects every request when CRON_SECRET is not configured, even with a matching header', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(makeRequest('Bearer correct-secret'))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(syncAllQuickbooksConnections).not.toHaveBeenCalled()
  })

  it('reports per-profile failures without failing the overall request', async () => {
    syncAllQuickbooksConnections.mockResolvedValue([
      { profileId: 'profile-a', result: { snapshotsSynced: 1, latestSnapshotId: 'snap-1' }, error: null },
      { profileId: 'profile-b', result: null, error: 'QuickBooks token refresh failed' },
    ])

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ total: 2, succeeded: 1, failed: 1, results: expect.any(Array) })
  })
})
