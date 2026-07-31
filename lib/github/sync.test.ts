import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { getGithubConnection, fetchRepo, fetchOpenPullRequests, fetchOpenCriticalIssues, fetchRecentCommitCount } =
  vi.hoisted(() => ({
    getGithubConnection: vi.fn(),
    fetchRepo: vi.fn(),
    fetchOpenPullRequests: vi.fn(),
    fetchOpenCriticalIssues: vi.fn(),
    fetchRecentCommitCount: vi.fn(),
  }))
vi.mock('./client', () => ({ getGithubConnection }))
vi.mock('./repos', () => ({ fetchRepo, fetchOpenPullRequests, fetchOpenCriticalIssues, fetchRecentCommitCount }))

const { analyzeEngineeringSnapshot } = vi.hoisted(() => ({ analyzeEngineeringSnapshot: vi.fn() }))
vi.mock('@/lib/github-risk-engine/analyze', () => ({ analyzeEngineeringSnapshot }))

let connectionsTable: { profile_id: string }[] = []

function makeAdminDb() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'github_connections') {
        return {
          select: vi.fn(() => Promise.resolve({ data: connectionsTable, error: null })),
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
        }
      }
      if (table === 'engineering_snapshots') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'snap-1' }, error: null })),
            })),
          })),
        }
      }
      throw new Error(`Unexpected table in test: ${table}`)
    }),
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => makeAdminDb()) }))

import { syncAllGithubConnections } from './sync'

describe('syncAllGithubConnections', () => {
  beforeEach(() => {
    connectionsTable = [{ profile_id: 'profile-a' }, { profile_id: 'profile-b' }, { profile_id: 'profile-c' }]
    fetchRepo.mockReset().mockResolvedValue({ defaultBranch: 'main' })
    fetchOpenPullRequests.mockReset().mockResolvedValue([])
    fetchOpenCriticalIssues.mockReset().mockResolvedValue([])
    fetchRecentCommitCount.mockReset().mockResolvedValue(10)
    analyzeEngineeringSnapshot.mockReset().mockResolvedValue([])
    getGithubConnection.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('processes every connected profile when all succeed', async () => {
    getGithubConnection.mockResolvedValue({
      id: 'conn-1',
      repo_owner: 'acme',
      repo_name: 'api',
      access_token: 'token',
    })

    const results = await syncAllGithubConnections()

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.error === null)).toBe(true)
  })

  it('isolates a failure in one profile so the others still get processed', async () => {
    getGithubConnection.mockImplementation(async (profileId: string) => {
      if (profileId === 'profile-b') {
        throw new Error('GitHub is not connected for this profile.')
      }
      return { id: `conn-${profileId}`, repo_owner: 'acme', repo_name: 'api', access_token: 'token' }
    })

    const results = await syncAllGithubConnections()
    const byProfile = new Map(results.map((r) => [r.profileId, r]))

    expect(byProfile.get('profile-a')?.error).toBeNull()
    expect(byProfile.get('profile-c')?.error).toBeNull()

    const failed = byProfile.get('profile-b')
    expect(failed?.error).toBe('GitHub is not connected for this profile.')
    expect(failed?.result).toBeNull()

    expect(getGithubConnection).toHaveBeenCalledWith('profile-a')
    expect(getGithubConnection).toHaveBeenCalledWith('profile-c')
  })

  it('only calls read (fetch*) helpers from ./repos — never a write method', async () => {
    getGithubConnection.mockResolvedValue({
      id: 'conn-1',
      repo_owner: 'acme',
      repo_name: 'api',
      access_token: 'token',
    })

    await syncAllGithubConnections()

    expect(fetchRepo).toHaveBeenCalledWith('token', 'acme', 'api')
    expect(fetchOpenPullRequests).toHaveBeenCalledWith('token', 'acme', 'api')
    expect(fetchOpenCriticalIssues).toHaveBeenCalledWith('token', 'acme', 'api')
    expect(fetchRecentCommitCount).toHaveBeenCalledWith('token', 'acme', 'api', 'main')
  })
})
