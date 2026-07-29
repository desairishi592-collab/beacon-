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

const CHECK_IN_QUESTIONS: CheckInQuestion[] = [
  { id: 'patient_safety', prompt: 'Any patient safety incidents or near-misses this period?' },
  { id: 'staffing', prompt: 'Is staffing adequate to safely cover current patient load?' },
  { id: 'compliance', prompt: 'Any compliance, credentialing, or regulatory issues?' },
  { id: 'supply', prompt: 'Any shortages of critical supplies, medications, or equipment?' },
]

export function getCheckInQuestions(): CheckInQuestion[] {
  return CHECK_IN_QUESTIONS
}
