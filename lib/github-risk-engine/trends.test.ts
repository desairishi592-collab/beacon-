import { describe, expect, it } from 'vitest'
import type { EngineeringRiskFlag } from '@/lib/supabase/types'
import { overallSnapshotSeverity, severityTrend } from './trends'

function flag(severity: EngineeringRiskFlag['severity']): EngineeringRiskFlag {
  return {
    id: severity,
    snapshot_id: 'snap',
    profile_id: 'profile',
    signal_type: 'stale_pull_requests',
    severity,
    metric_value: 1,
    threshold_value: null,
    metric_label: 'test',
    title: 'test',
    explanation: 'test',
    recommendation: 'test',
    raw_signal: {},
    created_at: '2026-02-01T00:00:00Z',
  }
}

describe('overallSnapshotSeverity', () => {
  it('scores a snapshot with no flags as 0', () => {
    expect(overallSnapshotSeverity([])).toBe(0)
  })

  it('takes the highest severity among the snapshot\'s flags', () => {
    expect(overallSnapshotSeverity([flag('low'), flag('critical'), flag('medium')])).toBe(4)
  })
})

describe('severityTrend', () => {
  it('reports no delta until a full prior window exists', () => {
    expect(severityTrend([0, 1]).delta).toBeNull()
  })

  it('is negative (improving) when recent severity is lower than the prior window', () => {
    const trend = severityTrend([4, 4, 4, 0, 0, 0])
    expect(trend.delta).toBeLessThan(0)
  })

  it('is positive (worsening) when recent severity is higher than the prior window', () => {
    const trend = severityTrend([0, 0, 0, 4, 4, 4])
    expect(trend.delta).toBeGreaterThan(0)
  })
})
