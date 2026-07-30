import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { chainJsonCompletion } = vi.hoisted(() => ({ chainJsonCompletion: vi.fn() }))
vi.mock('@/lib/ai/chain', () => ({ chainJsonCompletion }))

import { explainCheckinSignals } from './explain'
import type { CheckinRiskSignal } from './types'

function makeSignal(overrides: Partial<CheckinRiskSignal> = {}): CheckinRiskSignal {
  return {
    type: 'checkin_concern',
    severity: 'high',
    metricValue: 4,
    thresholdValue: 3,
    metricLabel: 'checkin_concern:patient_safety',
    title: 'Elevated concern: Any patient safety incidents or near-misses this period',
    explanation: 'Rated "Significant" (4/5) on this check-in.',
    recommendation: 'Discuss this concern with your team and agree on a next step to address it.',
    context: { questionId: 'patient_safety', prompt: 'Any patient safety incidents or near-misses this period?', rating: 4 },
    ...overrides,
  }
}

describe('explainCheckinSignals', () => {
  it('returns an empty array without calling the AI chain when there are no signals', async () => {
    const result = await explainCheckinSignals([], 'medicine', null)
    expect(result).toEqual([])
    expect(chainJsonCompletion).not.toHaveBeenCalled()
  })

  it("overrides each signal's recommendation, matched back by metric_label", async () => {
    chainJsonCompletion.mockResolvedValue({
      flags: [
        {
          metric_label: 'checkin_concern:patient_safety',
          recommendation: 'File an incident report for the near-miss and review the med pass process with the charge nurse today.',
        },
      ],
    })

    const [result] = await explainCheckinSignals([makeSignal()], 'medicine', 'Two near-misses during med pass.')

    expect(result.recommendation).toBe(
      'File an incident report for the near-miss and review the med pass process with the charge nurse today.'
    )
    expect(result.title).toBe(makeSignal().title)
  })

  it('throws when the AI chain omits a recommendation for a signal', async () => {
    chainJsonCompletion.mockResolvedValue({ flags: [] })

    await expect(explainCheckinSignals([makeSignal()], 'medicine', null)).rejects.toThrow(
      /Missing AI recommendation/
    )
  })
})
