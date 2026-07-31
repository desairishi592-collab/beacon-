import { describe, expect, it } from 'vitest'
import type { EngineeringSnapshot } from '@/lib/supabase/types'
import { computeEngineeringRiskSignals } from './signals'
import type { RiskSignal } from './types'

function makeSnapshot(overrides: Partial<EngineeringSnapshot> = {}): EngineeringSnapshot {
  return {
    id: 'snap',
    profile_id: 'profile',
    synced_at: '2026-02-01T00:00:00Z',
    open_pr_count: 0,
    oldest_open_pr_days: null,
    oldest_open_pr_number: null,
    oldest_open_pr_title: null,
    open_critical_issue_count: 0,
    oldest_critical_issue_days: null,
    oldest_critical_issue_number: null,
    oldest_critical_issue_title: null,
    commits_last_30_days: 40,
    source: 'github',
    created_at: '2026-02-01T00:00:00Z',
    ...overrides,
  }
}

function findSignal(signals: RiskSignal[], type: RiskSignal['type']) {
  return signals.find((s) => s.type === type)
}

describe('stale pull requests signal', () => {
  it('does not flag when there are no open PRs', () => {
    const signals = computeEngineeringRiskSignals({ current: makeSnapshot(), prior: null })
    expect(findSignal(signals, 'stale_pull_requests')).toBeUndefined()
  })

  it('does not flag a fresh open PR', () => {
    const current = makeSnapshot({ open_pr_count: 1, oldest_open_pr_days: 2, oldest_open_pr_number: 5 })
    const signals = computeEngineeringRiskSignals({ current, prior: null })
    expect(findSignal(signals, 'stale_pull_requests')).toBeUndefined()
  })

  it('flags medium when the oldest open PR crosses 7 days', () => {
    const current = makeSnapshot({ open_pr_count: 1, oldest_open_pr_days: 8, oldest_open_pr_number: 5 })
    const signals = computeEngineeringRiskSignals({ current, prior: null })
    const signal = findSignal(signals, 'stale_pull_requests')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
  })

  it('flags critical when the oldest open PR is 30+ days old', () => {
    const current = makeSnapshot({ open_pr_count: 1, oldest_open_pr_days: 31, oldest_open_pr_number: 5 })
    const signals = computeEngineeringRiskSignals({ current, prior: null })
    const signal = findSignal(signals, 'stale_pull_requests')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('critical')
  })
})

describe('unresolved critical issues signal', () => {
  it('does not flag when there are no matching open issues', () => {
    const signals = computeEngineeringRiskSignals({ current: makeSnapshot(), prior: null })
    expect(findSignal(signals, 'unresolved_critical_issues')).toBeUndefined()
  })

  it('flags high when the oldest critical issue crosses 14 days', () => {
    const current = makeSnapshot({
      open_critical_issue_count: 2,
      oldest_critical_issue_days: 15,
      oldest_critical_issue_number: 42,
    })
    const signals = computeEngineeringRiskSignals({ current, prior: null })
    const signal = findSignal(signals, 'unresolved_critical_issues')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('high')
  })
})

describe('deploy frequency drop signal', () => {
  it('does not flag without a prior snapshot', () => {
    const signals = computeEngineeringRiskSignals({ current: makeSnapshot({ commits_last_30_days: 5 }), prior: null })
    expect(findSignal(signals, 'deploy_frequency_drop')).toBeUndefined()
  })

  it('does not flag when commit frequency held steady or increased', () => {
    const current = makeSnapshot({ commits_last_30_days: 45 })
    const prior = makeSnapshot({ commits_last_30_days: 40 })
    const signals = computeEngineeringRiskSignals({ current, prior })
    expect(findSignal(signals, 'deploy_frequency_drop')).toBeUndefined()
  })

  it('flags medium when commits drop 30%+', () => {
    const current = makeSnapshot({ commits_last_30_days: 28 })
    const prior = makeSnapshot({ commits_last_30_days: 40 })
    const signals = computeEngineeringRiskSignals({ current, prior })
    const signal = findSignal(signals, 'deploy_frequency_drop')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
  })

  it('flags critical when commits drop 75%+', () => {
    const current = makeSnapshot({ commits_last_30_days: 5 })
    const prior = makeSnapshot({ commits_last_30_days: 40 })
    const signals = computeEngineeringRiskSignals({ current, prior })
    const signal = findSignal(signals, 'deploy_frequency_drop')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('critical')
  })

  it('does not flag when prior had zero commits (division by zero guard)', () => {
    const current = makeSnapshot({ commits_last_30_days: 5 })
    const prior = makeSnapshot({ commits_last_30_days: 0 })
    const signals = computeEngineeringRiskSignals({ current, prior })
    expect(findSignal(signals, 'deploy_frequency_drop')).toBeUndefined()
  })
})
