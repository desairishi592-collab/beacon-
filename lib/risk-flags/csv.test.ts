import { describe, expect, it } from 'vitest'
import type { RiskFlag } from '@/lib/supabase/types'
import { buildRiskFlagsCsv } from './csv'

function makeFlag(overrides: Partial<RiskFlag> = {}): RiskFlag {
  return {
    id: 'flag-1',
    snapshot_id: 'snapshot-1',
    profile_id: 'user-1',
    signal_type: 'cash_runway',
    severity: 'critical',
    metric_value: 0.8,
    threshold_value: 1,
    metric_label: 'cash_runway_months',
    title: 'Cash runway critical',
    explanation: 'At the current burn rate, cash runs out in under a month.',
    recommendation: 'Cut discretionary spend immediately.',
    raw_signal: {},
    created_at: '2026-07-20T12:00:00.000Z',
    ...overrides,
  }
}

describe('buildRiskFlagsCsv', () => {
  it('includes date, severity, signal type label, and description for each flag', () => {
    const csv = buildRiskFlagsCsv([makeFlag()])
    const [header, dataRow] = csv.split('\r\n')

    expect(header).toBe('Date,Severity,Signal Type,Description')
    expect(dataRow).toBe(
      '"July 20, 2026",Critical,Cash runway,"At the current burn rate, cash runs out in under a month."',
    )
  })

  it('maps every signal type to its human-readable label', () => {
    const csv = buildRiskFlagsCsv([
      makeFlag({ id: 'a', signal_type: 'burn_rate' }),
      makeFlag({ id: 'b', signal_type: 'dscr' }),
      makeFlag({ id: 'c', signal_type: 'expense_concentration' }),
      makeFlag({ id: 'd', signal_type: 'anomaly' }),
    ])
    const [, ...rows] = csv.split('\r\n')

    expect(rows[0]).toContain('Burn rate')
    expect(rows[1]).toContain('Debt service coverage')
    expect(rows[2]).toContain('Expense concentration')
    expect(rows[3]).toContain('Anomaly')
  })

  it('capitalizes severity for display', () => {
    const csv = buildRiskFlagsCsv([makeFlag({ severity: 'low' })])
    const [, dataRow] = csv.split('\r\n')

    expect(dataRow).toContain(',Low,')
  })

  it('escapes commas and quotes in the description field', () => {
    const csv = buildRiskFlagsCsv([
      makeFlag({ explanation: 'Expenses, including "one-time" costs, spiked sharply.' }),
    ])
    const [, dataRow] = csv.split('\r\n')

    expect(dataRow.endsWith('"Expenses, including ""one-time"" costs, spiked sharply."')).toBe(true)
  })

  it('returns just the header when there are no flags', () => {
    const csv = buildRiskFlagsCsv([])
    expect(csv).toBe('Date,Severity,Signal Type,Description')
  })
})
