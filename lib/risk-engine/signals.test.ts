import { describe, expect, it } from 'vitest'
import type { NormalizedShift } from '@/lib/schedule-uploads/normalize'
import { computeScheduleRiskSignals } from './signals'

function shift(overrides: Partial<NormalizedShift> & { employee: string; date: string }): NormalizedShift {
  return {
    startMinutes: null,
    endMinutes: null,
    role: null,
    status: null,
    ...overrides,
  }
}

describe('computeScheduleRiskSignals', () => {
  it('flags an understaffed shift when a role drops well below its typical headcount', () => {
    const dates = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']
    const shifts: NormalizedShift[] = []
    for (const date of dates) {
      const count = date === '2026-07-05' ? 1 : 3
      for (let i = 0; i < count; i++) {
        shifts.push(shift({ employee: `RN ${i}`, date, role: 'RN' }))
      }
    }

    const signals = computeScheduleRiskSignals(shifts)
    const flag = signals.find((s) => s.type === 'understaffed_shift' && s.metricLabel.includes('2026-07-05'))

    expect(flag).toBeDefined()
    expect(flag!.metricValue).toBe(1)
    expect(flag!.thresholdValue).toBe(3)
    expect(flag!.severity).toBe('high')
  })

  it('does not flag understaffing without enough dates to establish a baseline', () => {
    const shifts: NormalizedShift[] = [
      shift({ employee: 'A', date: '2026-07-01', role: 'RN' }),
      shift({ employee: 'B', date: '2026-07-01', role: 'RN' }),
      shift({ employee: 'A', date: '2026-07-02', role: 'RN' }),
    ]

    expect(computeScheduleRiskSignals(shifts).filter((s) => s.type === 'understaffed_shift')).toEqual([])
  })

  it('flags a single point of failure when one employee covers all shifts for a role', () => {
    const shifts = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'].map((date) =>
      shift({ employee: 'Jane Doe', date, role: 'Charge Nurse' })
    )

    const signals = computeScheduleRiskSignals(shifts)
    const flag = signals.find((s) => s.type === 'single_point_of_failure')

    expect(flag).toBeDefined()
    expect(flag!.metricValue).toBe(5)
    expect(flag!.severity).toBe('high')
    expect(flag!.explanation).toContain('Jane Doe')
  })

  it('does not flag single point of failure when multiple people cover the role', () => {
    const shifts = [
      shift({ employee: 'A', date: '2026-07-01', role: 'RN' }),
      shift({ employee: 'B', date: '2026-07-02', role: 'RN' }),
      shift({ employee: 'A', date: '2026-07-03', role: 'RN' }),
    ]

    expect(computeScheduleRiskSignals(shifts).filter((s) => s.type === 'single_point_of_failure')).toEqual([])
  })

  it('flags excessive consecutive shifts', () => {
    const dates = Array.from({ length: 9 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`)
    const shifts = dates.map((date) => shift({ employee: 'Jane Doe', date }))

    const signals = computeScheduleRiskSignals(shifts)
    const flag = signals.find((s) => s.type === 'excessive_consecutive_shifts')

    expect(flag).toBeDefined()
    expect(flag!.metricValue).toBe(9)
    expect(flag!.severity).toBe('high')
  })

  it('does not flag a short run of consecutive shifts', () => {
    const dates = ['2026-07-01', '2026-07-02', '2026-07-03']
    const shifts = dates.map((date) => shift({ employee: 'Jane Doe', date }))

    expect(computeScheduleRiskSignals(shifts).filter((s) => s.type === 'excessive_consecutive_shifts')).toEqual([])
  })

  it('flags a no-rest violation between consecutive shifts', () => {
    const shifts: NormalizedShift[] = [
      shift({ employee: 'Jane Doe', date: '2026-07-01', startMinutes: 8 * 60, endMinutes: 20 * 60 }),
      shift({ employee: 'Jane Doe', date: '2026-07-02', startMinutes: 1 * 60, endMinutes: 13 * 60 }),
    ]

    const signals = computeScheduleRiskSignals(shifts)
    const flag = signals.find((s) => s.type === 'no_rest_violation')

    expect(flag).toBeDefined()
    expect(flag!.metricValue).toBe(5)
    expect(flag!.severity).toBe('high')
  })

  it('does not flag rest gaps that meet the minimum threshold', () => {
    const shifts: NormalizedShift[] = [
      shift({ employee: 'Jane Doe', date: '2026-07-01', startMinutes: 8 * 60, endMinutes: 16 * 60 }),
      shift({ employee: 'Jane Doe', date: '2026-07-02', startMinutes: 8 * 60, endMinutes: 16 * 60 }),
    ]

    expect(computeScheduleRiskSignals(shifts).filter((s) => s.type === 'no_rest_violation')).toEqual([])
  })

  it('skips the no-rest check entirely when times were not mapped', () => {
    const shifts: NormalizedShift[] = [
      shift({ employee: 'Jane Doe', date: '2026-07-01' }),
      shift({ employee: 'Jane Doe', date: '2026-07-02' }),
    ]

    expect(computeScheduleRiskSignals(shifts).filter((s) => s.type === 'no_rest_violation')).toEqual([])
  })

  it('flags multiple call-outs on the same day', () => {
    const shifts: NormalizedShift[] = [
      shift({ employee: 'A', date: '2026-07-01', status: 'Call Out' }),
      shift({ employee: 'B', date: '2026-07-01', status: 'No Show' }),
    ]

    const signals = computeScheduleRiskSignals(shifts)
    const flag = signals.find((s) => s.type === 'coverage_gap' && s.metricLabel.includes('date'))

    expect(flag).toBeDefined()
    expect(flag!.metricValue).toBe(2)
    expect(flag!.severity).toBe('medium')
  })

  it('flags a recurring call-out pattern for one employee', () => {
    const shifts: NormalizedShift[] = ['2026-07-01', '2026-07-08', '2026-07-15'].map((date) =>
      shift({ employee: 'Jane Doe', date, status: 'sick' })
    )

    const signals = computeScheduleRiskSignals(shifts)
    const flag = signals.find((s) => s.type === 'coverage_gap' && s.metricLabel.includes('employee'))

    expect(flag).toBeDefined()
    expect(flag!.metricValue).toBe(3)
  })

  it('does not flag coverage gaps when status was not mapped', () => {
    const shifts: NormalizedShift[] = [
      shift({ employee: 'A', date: '2026-07-01' }),
      shift({ employee: 'B', date: '2026-07-01' }),
    ]

    expect(computeScheduleRiskSignals(shifts).filter((s) => s.type === 'coverage_gap')).toEqual([])
  })

  it('returns no signals for a small, healthy schedule', () => {
    const shifts: NormalizedShift[] = [
      shift({ employee: 'A', date: '2026-07-01', role: 'RN', status: 'filled' }),
      shift({ employee: 'B', date: '2026-07-01', role: 'RN', status: 'filled' }),
    ]

    expect(computeScheduleRiskSignals(shifts)).toEqual([])
  })
})
