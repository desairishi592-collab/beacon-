import { describe, expect, it } from 'vitest'
import { overallSeverity, severityBand } from './severity'

describe('overallSeverity', () => {
  it('returns the worst (max) rating across all responses, not the average', () => {
    expect(overallSeverity({ a: 1, b: 4, c: 2 })).toBe(4)
  })

  it('returns 0 for a check-in with no responses instead of crashing', () => {
    expect(overallSeverity({})).toBe(0)
  })
})

describe('severityBand', () => {
  it('bands ratings below the moderate threshold as low', () => {
    expect(severityBand(1)).toBe('low')
    expect(severityBand(2)).toBe('low')
  })

  it('bands ratings at or above moderate but below severe as moderate', () => {
    expect(severityBand(3)).toBe('moderate')
  })

  it('bands ratings at or above the severe threshold as severe', () => {
    expect(severityBand(4)).toBe('severe')
    expect(severityBand(5)).toBe('severe')
  })
})
