import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { chainJsonCompletion } = vi.hoisted(() => ({ chainJsonCompletion: vi.fn() }))
vi.mock('@/lib/ai/chain', () => ({ chainJsonCompletion }))

import { explainScheduleRecommendations } from './explain'
import type { RiskSignal } from './types'

function makeSignal(overrides: Partial<RiskSignal> = {}): RiskSignal {
  return {
    type: 'single_point_of_failure',
    severity: 'high',
    metricValue: 5,
    thresholdValue: 3,
    metricLabel: 'single_point_of_failure:Charge Nurse',
    title: 'Charge Nurse coverage depends on one person',
    explanation: 'Jane Doe is the only staff member scheduled for the Charge Nurse role.',
    recommendation: 'Cross-train another team member.',
    context: { role: 'Charge Nurse', employee: 'Jane Doe', shiftCount: 5 },
    ...overrides,
  }
}

describe('explainScheduleRecommendations', () => {
  it('returns an empty array without calling the AI chain when there are no signals', async () => {
    const result = await explainScheduleRecommendations([])
    expect(result).toEqual([])
    expect(chainJsonCompletion).not.toHaveBeenCalled()
  })

  it('overrides each signal\'s recommendation, matched back by metric_label', async () => {
    chainJsonCompletion.mockResolvedValue({
      flags: [
        { metric_label: 'single_point_of_failure:Charge Nurse', recommendation: 'Cross-train Alex Kim on Charge Nurse duties this week.' },
      ],
    })

    const [result] = await explainScheduleRecommendations([makeSignal()])

    expect(result.recommendation).toBe('Cross-train Alex Kim on Charge Nurse duties this week.')
    expect(result.title).toBe('Charge Nurse coverage depends on one person')
  })

  it('throws when the AI chain omits a recommendation for a signal', async () => {
    chainJsonCompletion.mockResolvedValue({ flags: [] })

    await expect(explainScheduleRecommendations([makeSignal()])).rejects.toThrow(/Missing AI recommendation/)
  })
})
