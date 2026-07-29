import { describe, expect, it } from 'vitest'
import type { ManualCheckin } from '@/lib/supabase/types'
import type { CheckInQuestion } from './questions'
import { monthOverMonthComparison, recurringRiskAreas, severityTrend } from './trends'

const QUESTIONS: CheckInQuestion[] = [
  { id: 'timeline_risk', prompt: 'Is any active project at risk of missing its deadline?' },
  { id: 'tech_debt', prompt: 'Are unresolved critical bugs or technical debt piling up?' },
]

function checkin(responses: Record<string, number>, createdAt: string): ManualCheckin {
  return { id: createdAt, profile_id: 'p1', field: 'medicine', responses, notes: null, created_at: createdAt }
}

describe('recurringRiskAreas', () => {
  it('ranks questions by how often they were flagged moderate-or-worse, most frequent first', () => {
    const checkins = [
      checkin({ timeline_risk: 4, tech_debt: 1 }, '2026-01-01'),
      checkin({ timeline_risk: 4, tech_debt: 4 }, '2026-01-08'),
      checkin({ timeline_risk: 1, tech_debt: 1 }, '2026-01-15'),
    ]
    const areas = recurringRiskAreas(checkins, QUESTIONS)
    expect(areas.map((a) => a.questionId)).toEqual(['timeline_risk', 'tech_debt'])
    expect(areas[0].flaggedCount).toBe(2)
    expect(areas[1].flaggedCount).toBe(1)
  })

  it('excludes questions that were never flagged moderate-or-worse', () => {
    const checkins = [checkin({ timeline_risk: 1, tech_debt: 2 }, '2026-01-01')]
    expect(recurringRiskAreas(checkins, QUESTIONS)).toEqual([])
  })

  it('ignores check-ins that never answered a given question rather than crashing', () => {
    const checkins = [checkin({ timeline_risk: 4 }, '2026-01-01')]
    const areas = recurringRiskAreas(checkins, QUESTIONS)
    expect(areas).toEqual([{ questionId: 'timeline_risk', prompt: QUESTIONS[0].prompt, flaggedCount: 1, totalCount: 1 }])
  })
})

describe('severityTrend', () => {
  it('returns a null delta when there is no full prior window to compare against', () => {
    const checkins = [checkin({ q: 2 }, '2026-01-01'), checkin({ q: 3 }, '2026-01-08')]
    expect(severityTrend(checkins, 3).delta).toBeNull()
  })

  it('reports a positive delta when the recent window is worse (higher severity) than the prior one', () => {
    const checkins = [
      checkin({ q: 1 }, '2026-01-01'),
      checkin({ q: 1 }, '2026-01-08'),
      checkin({ q: 1 }, '2026-01-15'),
      checkin({ q: 5 }, '2026-01-22'),
      checkin({ q: 5 }, '2026-01-29'),
      checkin({ q: 5 }, '2026-02-05'),
    ]
    const trend = severityTrend(checkins, 3)
    expect(trend.recentAverage).toBe(5)
    expect(trend.delta).toBe(4)
  })

  it('reports a negative delta when the recent window is better (lower severity) than the prior one', () => {
    const checkins = [
      checkin({ q: 5 }, '2026-01-01'),
      checkin({ q: 5 }, '2026-01-08'),
      checkin({ q: 1 }, '2026-01-15'),
      checkin({ q: 1 }, '2026-01-22'),
    ]
    const trend = severityTrend(checkins, 2)
    expect(trend.delta).toBe(-4)
  })
})

describe('monthOverMonthComparison', () => {
  it('returns null when all check-ins fall within a single calendar month', () => {
    const checkins = [checkin({ timeline_risk: 1 }, '2026-01-01'), checkin({ timeline_risk: 4 }, '2026-01-20')]
    expect(monthOverMonthComparison(checkins, QUESTIONS)).toBeNull()
  })

  it('reports an "up" (worsening) trend when this month is more severe than last month', () => {
    const checkins = [
      checkin({ timeline_risk: 1, tech_debt: 1 }, '2026-01-05'),
      checkin({ timeline_risk: 1, tech_debt: 1 }, '2026-01-20'),
      checkin({ timeline_risk: 5, tech_debt: 5 }, '2026-02-05'),
    ]
    const comparison = monthOverMonthComparison(checkins, QUESTIONS)
    expect(comparison?.currentLabel).toBe('February 2026')
    expect(comparison?.priorLabel).toBe('January 2026')
    expect(comparison?.trend).toBe('up')
    expect(comparison?.delta).toBeCloseTo(4)
  })

  it('reports a "down" (improving) trend when this month is less severe than last month', () => {
    const checkins = [
      checkin({ timeline_risk: 5 }, '2026-01-05'),
      checkin({ timeline_risk: 1 }, '2026-02-05'),
    ]
    const comparison = monthOverMonthComparison(checkins, QUESTIONS)
    expect(comparison?.trend).toBe('down')
  })

  it('reports a "flat" trend when the delta between months is negligible', () => {
    const checkins = [checkin({ timeline_risk: 3 }, '2026-01-05'), checkin({ timeline_risk: 3 }, '2026-02-05')]
    const comparison = monthOverMonthComparison(checkins, QUESTIONS)
    expect(comparison?.trend).toBe('flat')
  })

  it('surfaces a question as a new risk area only when flagged this month but not last month', () => {
    const checkins = [
      checkin({ timeline_risk: 1, tech_debt: 1 }, '2026-01-05'),
      checkin({ timeline_risk: 4, tech_debt: 1 }, '2026-02-05'),
    ]
    const comparison = monthOverMonthComparison(checkins, QUESTIONS)
    expect(comparison?.newRiskAreas).toEqual([{ questionId: 'timeline_risk', prompt: QUESTIONS[0].prompt }])
  })

  it('does not surface a risk area as new if it was already flagged last month', () => {
    const checkins = [
      checkin({ timeline_risk: 4 }, '2026-01-05'),
      checkin({ timeline_risk: 4 }, '2026-02-05'),
    ]
    const comparison = monthOverMonthComparison(checkins, QUESTIONS)
    expect(comparison?.newRiskAreas).toEqual([])
  })
})
