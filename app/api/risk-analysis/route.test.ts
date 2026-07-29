import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { RiskFlag } from '@/lib/supabase/types'

const { analyzeSnapshot, notifyNewRiskFlags, getRequestOrigin } = vi.hoisted(() => ({
  analyzeSnapshot: vi.fn(),
  notifyNewRiskFlags: vi.fn(),
  getRequestOrigin: vi.fn(),
}))

vi.mock('@/lib/risk-engine/analyze', () => ({ analyzeSnapshot }))
vi.mock('@/lib/notifications/risk-flag-email', () => ({ notifyNewRiskFlags }))
vi.mock('@/lib/request-origin', () => ({ getRequestOrigin }))

import { POST } from './route'

function makeRequest(options: { secret?: string | null; body?: unknown } = {}): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.secret !== null) {
    headers['x-risk-analysis-secret'] = options.secret ?? 'correct-secret'
  }
  return new NextRequest('http://localhost/api/risk-analysis', {
    method: 'POST',
    headers,
    body: options.body === undefined ? JSON.stringify({ snapshot_id: 'snap-1' }) : JSON.stringify(options.body),
  })
}

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

describe('POST /api/risk-analysis', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.RISK_ANALYSIS_TRIGGER_SECRET = 'correct-secret'
    analyzeSnapshot.mockReset()
    notifyNewRiskFlags.mockReset().mockResolvedValue(undefined)
    getRequestOrigin.mockReset().mockResolvedValue('https://app.beacon.test')
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('authorizes and processes a request with the correct shared secret', async () => {
    const flags = [makeFlag()]
    analyzeSnapshot.mockResolvedValue(flags)

    const response = await POST(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ flags })
    expect(analyzeSnapshot).toHaveBeenCalledWith('snap-1')
    expect(notifyNewRiskFlags).toHaveBeenCalledWith(flags, 'https://app.beacon.test')
  })

  it('rejects a request with a missing secret header before doing any work', async () => {
    const response = await POST(makeRequest({ secret: null }))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(analyzeSnapshot).not.toHaveBeenCalled()
    expect(notifyNewRiskFlags).not.toHaveBeenCalled()
  })

  it('rejects a request with an incorrect secret header before doing any work', async () => {
    const response = await POST(makeRequest({ secret: 'wrong-secret' }))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(analyzeSnapshot).not.toHaveBeenCalled()
    expect(notifyNewRiskFlags).not.toHaveBeenCalled()
  })

  it('rejects every request when RISK_ANALYSIS_TRIGGER_SECRET is not configured, even with a matching header', async () => {
    delete process.env.RISK_ANALYSIS_TRIGGER_SECRET

    const response = await POST(makeRequest({ secret: 'correct-secret' }))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(analyzeSnapshot).not.toHaveBeenCalled()
  })

  it('rejects an authorized request missing snapshot_id before calling the risk engine', async () => {
    const response = await POST(makeRequest({ body: {} }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'snapshot_id is required' })
    expect(analyzeSnapshot).not.toHaveBeenCalled()
  })

  it('returns 404 when the risk engine reports the snapshot was not found', async () => {
    analyzeSnapshot.mockRejectedValue(new Error('Financial snapshot "snap-1" not found.'))

    const response = await POST(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json).toEqual({ error: 'Financial snapshot "snap-1" not found.' })
    expect(notifyNewRiskFlags).not.toHaveBeenCalled()
  })

  it('returns 500 when the risk engine throws an unexpected error', async () => {
    analyzeSnapshot.mockRejectedValue(new Error('Groq request failed.'))

    const response = await POST(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toEqual({ error: 'Groq request failed.' })
    expect(notifyNewRiskFlags).not.toHaveBeenCalled()
  })
})
