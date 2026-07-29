import { describe, expect, it } from 'vitest'
import { getCheckInQuestions } from './questions'

describe('getCheckInQuestions', () => {
  it('returns the medicine question set', () => {
    const questionIds = getCheckInQuestions().map((q) => q.id)
    expect(questionIds).toEqual(['patient_safety', 'staffing', 'compliance', 'supply'])
  })

  it('gives every question a non-empty id and prompt', () => {
    for (const question of getCheckInQuestions()) {
      expect(question.id.length).toBeGreaterThan(0)
      expect(question.prompt.length).toBeGreaterThan(0)
    }
  })
})
