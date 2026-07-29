import { describe, expect, it } from 'vitest'
import type { FinancialSnapshot } from '@/lib/supabase/types'
import { computeRiskSignals } from './signals'
import type { RiskSignal } from './types'

// period_start/period_end below span 31 days (~1.0185 months) consistently,
// so period length cancels out of period-over-period comparisons.
function makeSnapshot(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    id: 'snap',
    profile_id: 'profile',
    period_start: '2026-01-01',
    period_end: '2026-02-01',
    cash_balance: 500000,
    total_revenue: 200000,
    total_expenses: 150000,
    operating_income: 50000,
    total_debt_service: 10000,
    expense_breakdown: { payroll: 50000, rent: 40000, marketing: 35000, software: 25000 },
    source: 'manual',
    created_at: '2026-02-01T00:00:00Z',
    ...overrides,
  }
}

function findSignal(signals: RiskSignal[], type: RiskSignal['type'], metricLabel?: string) {
  return signals.find((s) => s.type === type && (metricLabel === undefined || s.metricLabel === metricLabel))
}

describe('cash runway signal', () => {
  it('does not flag when revenue covers expenses', () => {
    const signals = computeRiskSignals({ current: makeSnapshot(), prior: null })
    expect(findSignal(signals, 'cash_runway')).toBeUndefined()
  })

  it('flags when runway drops below the medium threshold', () => {
    const current = makeSnapshot({ total_revenue: 100000, total_expenses: 150000, cash_balance: 220000 })
    const signals = computeRiskSignals({ current, prior: null })
    const signal = findSignal(signals, 'cash_runway')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
  })

  it('flags critical when there is no cash left at all', () => {
    const current = makeSnapshot({ total_revenue: 100000, total_expenses: 150000, cash_balance: 0 })
    const signals = computeRiskSignals({ current, prior: null })
    const signal = findSignal(signals, 'cash_runway')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('critical')
    expect(signal!.metricValue).toBe(0)
  })
})

describe('burn rate signal', () => {
  it('does not flag when burn growth is modest', () => {
    const current = makeSnapshot({ total_revenue: 100000, total_expenses: 145000 })
    const prior = makeSnapshot({ total_revenue: 100000, total_expenses: 140000 })
    const signals = computeRiskSignals({ current, prior })
    expect(findSignal(signals, 'burn_rate')).toBeUndefined()
  })

  it('flags when burn accelerates past the growth threshold', () => {
    const current = makeSnapshot({ total_revenue: 100000, total_expenses: 235000 })
    const prior = makeSnapshot({ total_revenue: 100000, total_expenses: 200000 })
    const signals = computeRiskSignals({ current, prior })
    const signal = findSignal(signals, 'burn_rate')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('high')
  })

  it('flags when flipping from profitable to burning cash, even with no baseline percentage', () => {
    const current = makeSnapshot({ total_revenue: 100000, total_expenses: 150000 })
    const prior = makeSnapshot({ total_revenue: 200000, total_expenses: 150000 })
    const signals = computeRiskSignals({ current, prior })
    const signal = findSignal(signals, 'burn_rate')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
    expect(signal!.thresholdValue).toBe(0)
  })
})

describe('dscr signal', () => {
  it('does not flag when coverage is comfortably above the covenant', () => {
    const signals = computeRiskSignals({ current: makeSnapshot(), prior: null })
    expect(findSignal(signals, 'dscr')).toBeUndefined()
  })

  it('flags when coverage drops below the covenant', () => {
    const current = makeSnapshot({ operating_income: 11000, total_debt_service: 10000 })
    const signals = computeRiskSignals({ current, prior: null })
    const signal = findSignal(signals, 'dscr')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
  })

  it('does not flag when there is no debt service to cover', () => {
    const current = makeSnapshot({ operating_income: -5000, total_debt_service: 0 })
    const signals = computeRiskSignals({ current, prior: null })
    expect(findSignal(signals, 'dscr')).toBeUndefined()
  })
})

describe('expense concentration signal', () => {
  it('does not flag when expenses are spread across categories', () => {
    const signals = computeRiskSignals({ current: makeSnapshot(), prior: null })
    expect(findSignal(signals, 'expense_concentration')).toBeUndefined()
  })

  it('flags when one category dominates total expenses', () => {
    const current = makeSnapshot({
      expense_breakdown: { payroll: 70000, rent: 35000, marketing: 30000, software: 15000 },
    })
    const signals = computeRiskSignals({ current, prior: null })
    const signal = findSignal(signals, 'expense_concentration')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
  })

  it('does not flag when there is no expense breakdown data', () => {
    const current = makeSnapshot({ expense_breakdown: {} })
    const signals = computeRiskSignals({ current, prior: null })
    expect(findSignal(signals, 'expense_concentration')).toBeUndefined()
  })
})

describe('anomaly signals vs. prior period', () => {
  it('does not flag when metrics move only slightly period-over-period', () => {
    const current = makeSnapshot()
    const prior = makeSnapshot({
      total_revenue: 195000,
      total_expenses: 145000,
      cash_balance: 490000,
      expense_breakdown: { payroll: 48000, rent: 39000, marketing: 34000, software: 24000 },
    })
    const signals = computeRiskSignals({ current, prior })
    expect(signals.filter((s) => s.type === 'anomaly')).toHaveLength(0)
  })

  it('flags a sharp revenue drop', () => {
    const current = makeSnapshot({ total_revenue: 100000 })
    const prior = makeSnapshot({ total_revenue: 150000 })
    const signals = computeRiskSignals({ current, prior })
    const signal = findSignal(signals, 'anomaly', 'anomaly:total_revenue')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('high')
  })

  it('flags a sharp expense spike', () => {
    const current = makeSnapshot({
      total_expenses: 220000,
      expense_breakdown: { payroll: 73333, rent: 58667, marketing: 51333, software: 36667 },
    })
    const prior = makeSnapshot()
    const signals = computeRiskSignals({ current, prior })
    const signal = findSignal(signals, 'anomaly', 'anomaly:total_expenses')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
  })

  it('flags a sharp drop in cash balance', () => {
    const current = makeSnapshot({ cash_balance: 300000 })
    const prior = makeSnapshot()
    const signals = computeRiskSignals({ current, prior })
    const signal = findSignal(signals, 'anomaly', 'anomaly:cash_balance')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
  })

  it('flags a single category spiking sharply', () => {
    const current = makeSnapshot({
      expense_breakdown: { payroll: 90000, rent: 30000, marketing: 20000, software: 10000 },
    })
    const prior = makeSnapshot()
    const signals = computeRiskSignals({ current, prior })
    const signal = findSignal(signals, 'anomaly', 'anomaly:expense_breakdown.payroll')
    expect(signal).toBeDefined()
    expect(signal!.severity).toBe('medium')
  })

  it('does not flag or crash on a category with no prior-period counterpart', () => {
    const current = makeSnapshot({
      expense_breakdown: { payroll: 50000, rent: 40000, marketing: 35000, software: 25000, consulting: 20000 },
      total_expenses: 170000,
    })
    const prior = makeSnapshot()
    const signals = computeRiskSignals({ current, prior })
    expect(findSignal(signals, 'anomaly', 'anomaly:expense_breakdown.consulting')).toBeUndefined()
    expect(signals.filter((s) => s.type === 'anomaly')).toHaveLength(0)
  })
})
