import { describe, expect, it } from 'vitest'
import { computeCheckinRiskSignals } from './signals'

const questions = [
  { id: 'patient_safety', prompt: 'Any patient safety incidents or near-misses this period?' },
  { id: 'staffing', prompt: 'Is staffing adequate to safely cover current patient load?' },
]

describe('computeCheckinRiskSignals', () => {
  it('returns no signals when every rating is below the moderate threshold', () => {
    const signals = computeCheckinRiskSignals({ patient_safety: 1, staffing: 2 }, questions)
    expect(signals).toEqual([])
  })

  it('flags a question rated moderate (3) as medium severity', () => {
    const [signal] = computeCheckinRiskSignals({ patient_safety: 3 }, questions)
    expect(signal.severity).toBe('medium')
    expect(signal.metricLabel).toBe('checkin_concern:patient_safety')
    expect(signal.metricValue).toBe(3)
  })

  it('flags a question rated significant (4) as high severity', () => {
    const [signal] = computeCheckinRiskSignals({ patient_safety: 4 }, questions)
    expect(signal.severity).toBe('high')
  })

  it('flags a question rated severe (5) as critical severity', () => {
    const [signal] = computeCheckinRiskSignals({ patient_safety: 5 }, questions)
    expect(signal.severity).toBe('critical')
  })

  it('only flags questions that were actually answered', () => {
    const signals = computeCheckinRiskSignals({ patient_safety: 5 }, questions)
    expect(signals).toHaveLength(1)
  })

  it('flags multiple questions independently', () => {
    const signals = computeCheckinRiskSignals({ patient_safety: 5, staffing: 4 }, questions)
    expect(signals).toHaveLength(2)
    expect(signals.map((s) => s.metricLabel).sort()).toEqual([
      'checkin_concern:patient_safety',
      'checkin_concern:staffing',
    ])
  })
})
