import type { Field } from '@/lib/supabase/types'

export type CheckInQuestion = {
  id: string
  prompt: string
}

// Rating scale used for every question's answer (1-5, stored in
// manual_checkins.responses keyed by question id).
export const RATING_SCALE = [
  { value: 1, label: 'No concern' },
  { value: 2, label: 'Minor' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Significant' },
  { value: 5, label: 'Severe' },
] as const

// Fields without a data integration yet (see AGENTS.md / lib/quickbooks —
// finance is the only field wired up to an automated source so far).
export type ManualCheckinField = Exclude<Field, 'finance'>

const QUESTIONS_BY_FIELD: Record<ManualCheckinField, CheckInQuestion[]> = {
  medicine: [
    { id: 'patient_safety', prompt: 'Any patient safety incidents or near-misses this period?' },
    { id: 'staffing', prompt: 'Is staffing adequate to safely cover current patient load?' },
    { id: 'compliance', prompt: 'Any compliance, credentialing, or regulatory issues?' },
    { id: 'supply', prompt: 'Any shortages of critical supplies, medications, or equipment?' },
  ],
  engineering: [
    { id: 'timeline_risk', prompt: 'Is any active project at risk of missing its deadline?' },
    { id: 'tech_debt', prompt: 'Are unresolved critical bugs or technical debt piling up?' },
    { id: 'team_capacity', prompt: 'Is the team at risk of burnout or unexpected turnover?' },
    { id: 'security', prompt: 'Any known security vulnerabilities left unpatched?' },
  ],
  other: [
    { id: 'cashflow', prompt: 'Any cash flow or budget concerns this period?' },
    { id: 'staffing', prompt: 'Any staffing or turnover concerns?' },
    { id: 'compliance', prompt: 'Any compliance or legal concerns?' },
    { id: 'customer', prompt: 'Any notable rise in customer or client complaints?' },
  ],
}

export function isManualCheckinField(field: Field): field is ManualCheckinField {
  return field !== 'finance'
}

export function getCheckInQuestions(field: ManualCheckinField): CheckInQuestion[] {
  return QUESTIONS_BY_FIELD[field]
}
