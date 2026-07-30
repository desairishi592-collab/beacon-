import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { getQuickbooksConnection, getValidAccessToken, fetchProfitAndLossReport, fetchBalanceSheetReport, fetchCashFlowReport } =
  vi.hoisted(() => ({
    getQuickbooksConnection: vi.fn(),
    getValidAccessToken: vi.fn(),
    fetchProfitAndLossReport: vi.fn(),
    fetchBalanceSheetReport: vi.fn(),
    fetchCashFlowReport: vi.fn(),
  }))
vi.mock('./client', () => ({ getQuickbooksConnection, getValidAccessToken }))

vi.mock('./reports', () => ({
  fetchProfitAndLossReport,
  fetchBalanceSheetReport,
  fetchCashFlowReport,
  extractProfitAndLoss: vi.fn(() => ({
    totalRevenue: 100000,
    totalExpenses: 80000,
    operatingIncome: 20000,
    expenseBreakdown: { payroll: 80000 },
  })),
  extractCashBalance: vi.fn(() => 500000),
  extractDebtService: vi.fn(() => 5000),
}))

let connectionsTable: { profile_id: string }[] = []

function makeAdminDb() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'quickbooks_connections') {
        return {
          select: vi.fn(() => Promise.resolve({ data: connectionsTable, error: null })),
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
        }
      }
      if (table === 'financial_snapshots') {
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'snap-1' }, error: null })),
            })),
          })),
        }
      }
      if (table === 'quickbooks_sync_runs') {
        return { insert: vi.fn(() => Promise.resolve({ error: null })) }
      }
      throw new Error(`Unexpected table in test: ${table}`)
    }),
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => makeAdminDb()) }))

import { syncAllQuickbooksConnections } from './sync'

describe('syncAllQuickbooksConnections', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.RISK_ANALYSIS_TRIGGER_SECRET = 'trigger-secret'
    connectionsTable = [{ profile_id: 'profile-a' }, { profile_id: 'profile-b' }, { profile_id: 'profile-c' }]
    getQuickbooksConnection.mockReset()
    getValidAccessToken.mockReset().mockResolvedValue('access-token')
    fetchProfitAndLossReport.mockReset().mockResolvedValue({})
    fetchBalanceSheetReport.mockReset().mockResolvedValue({})
    fetchCashFlowReport.mockReset().mockResolvedValue({})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('processes every connected profile when all succeed', async () => {
    getQuickbooksConnection.mockResolvedValue({
      id: 'conn-1',
      realm_id: 'realm-1',
      access_token: 'token',
      access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })

    const results = await syncAllQuickbooksConnections('https://app.beacon.test')

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.error === null)).toBe(true)
  })

  it('isolates a failure in one profile so the others still get processed', async () => {
    getQuickbooksConnection.mockImplementation(async (profileId: string) => {
      if (profileId === 'profile-b') {
        throw new Error('QuickBooks token refresh failed for profile-b')
      }
      return {
        id: `conn-${profileId}`,
        realm_id: 'realm-1',
        access_token: 'token',
        access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      }
    })

    const results = await syncAllQuickbooksConnections('https://app.beacon.test')

    expect(results).toHaveLength(3)

    const byProfile = new Map(results.map((r) => [r.profileId, r]))
    expect(byProfile.get('profile-a')?.error).toBeNull()
    expect(byProfile.get('profile-c')?.error).toBeNull()

    const failed = byProfile.get('profile-b')
    expect(failed?.error).toBe('QuickBooks token refresh failed for profile-b')
    expect(failed?.result).toBeNull()

    // Both successful profiles were still fully attempted, not skipped.
    expect(getQuickbooksConnection).toHaveBeenCalledWith('profile-a')
    expect(getQuickbooksConnection).toHaveBeenCalledWith('profile-c')
  })

  it('isolates failures for multiple profiles independently, leaving the rest to succeed', async () => {
    getQuickbooksConnection.mockImplementation(async (profileId: string) => {
      if (profileId === 'profile-a' || profileId === 'profile-c') {
        throw new Error(`sync failed for ${profileId}`)
      }
      return {
        id: `conn-${profileId}`,
        realm_id: 'realm-1',
        access_token: 'token',
        access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      }
    })

    const results = await syncAllQuickbooksConnections('https://app.beacon.test')
    const byProfile = new Map(results.map((r) => [r.profileId, r]))

    expect(byProfile.get('profile-a')?.error).toBe('sync failed for profile-a')
    expect(byProfile.get('profile-c')?.error).toBe('sync failed for profile-c')
    expect(byProfile.get('profile-b')?.error).toBeNull()
  })
})
