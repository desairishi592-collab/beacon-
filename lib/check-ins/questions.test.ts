import { describe, expect, it } from 'vitest'
import type { Field } from '@/lib/supabase/types'
import { getCheckInQuestions, isManualCheckinField, type ManualCheckinField } from './questions'

const ids = (field: ManualCheckinField) => getCheckInQuestions(field).map((q) => q.id)

describe('isManualCheckinField', () => {
  it('routes finance users to the QuickBooks-based flow, not manual check-in', () => {
    expect(isManualCheckinField('finance')).toBe(false)
  })

  it('routes engineering, medicine, and other users to manual check-in', () => {
    expect(isManualCheckinField('engineering')).toBe(true)
    expect(isManualCheckinField('medicine')).toBe(true)
    expect(isManualCheckinField('other')).toBe(true)
  })

  it('falls back to manual check-in for an unrecognized field instead of crashing', () => {
    expect(() => isManualCheckinField('nonexistent-field' as Field)).not.toThrow()
    expect(isManualCheckinField('nonexistent-field' as Field)).toBe(true)
  })

  it('falls back to manual check-in for a null or undefined field instead of crashing', () => {
    expect(() => isManualCheckinField(null as unknown as Field)).not.toThrow()
    expect(isManualCheckinField(null as unknown as Field)).toBe(true)
    expect(isManualCheckinField(undefined as unknown as Field)).toBe(true)
  })
})

describe('getCheckInQuestions', () => {
  it('returns the engineering-specific question set, not another field\'s', () => {
    const questionIds = ids('engineering')
    expect(questionIds).toEqual(['timeline_risk', 'tech_debt', 'team_capacity', 'security'])
    expect(questionIds).not.toContain('patient_safety')
    expect(questionIds).not.toContain('cashflow')
  })

  it('returns the medicine-specific question set, not another field\'s', () => {
    const questionIds = ids('medicine')
    expect(questionIds).toEqual(['patient_safety', 'staffing', 'compliance', 'supply'])
    expect(questionIds).not.toContain('timeline_risk')
    expect(questionIds).not.toContain('cashflow')
  })

  it('returns the other-specific question set, not another field\'s', () => {
    const questionIds = ids('other')
    expect(questionIds).toEqual(['cashflow', 'staffing', 'compliance', 'customer'])
    expect(questionIds).not.toContain('timeline_risk')
    expect(questionIds).not.toContain('patient_safety')
  })

  it('gives every question a non-empty id and prompt', () => {
    for (const field of ['engineering', 'medicine', 'other'] as const) {
      for (const question of getCheckInQuestions(field)) {
        expect(question.id.length).toBeGreaterThan(0)
        expect(question.prompt.length).toBeGreaterThan(0)
      }
    }
  })

  it('does not crash on an unrecognized field', () => {
    expect(() => getCheckInQuestions('nonexistent-field' as ManualCheckinField)).not.toThrow()
    expect(getCheckInQuestions('nonexistent-field' as ManualCheckinField)).toBeUndefined()
  })
})
