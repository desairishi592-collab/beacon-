import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { getCurrentSession, revalidatePath, notifySevereCheckin, analyzeCheckin, getRequestOrigin } = vi.hoisted(
  () => ({
    getCurrentSession: vi.fn(),
    revalidatePath: vi.fn(),
    notifySevereCheckin: vi.fn(),
    analyzeCheckin: vi.fn(),
    getRequestOrigin: vi.fn(),
  })
)

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))
vi.mock('@/lib/notifications/check-in-email', () => ({ notifySevereCheckin }))
vi.mock('@/lib/checkin-risk-engine/analyze', () => ({ analyzeCheckin }))
vi.mock('@/lib/request-origin', () => ({ getRequestOrigin }))

import { submitCheckIn } from './actions'

function formDataFor(field: 'medicine' | 'engineering' | 'other', ratings: Record<string, number>, notes = '') {
  const formData = new FormData()
  for (const [key, value] of Object.entries(ratings)) {
    formData.set(key, String(value))
  }
  if (notes) formData.set('notes', notes)
  return formData
}

describe('submitCheckIn', () => {
  let insert: ReturnType<typeof vi.fn>
  let select: ReturnType<typeof vi.fn>
  let single: ReturnType<typeof vi.fn>
  let profileMaybeSingle: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({ data: { id: 'checkin-1' }, error: null })
    select = vi.fn(() => ({ single }))
    insert = vi.fn(() => ({ select }))
    profileMaybeSingle = vi.fn().mockResolvedValue({ data: { field: 'medicine' } })
    from = vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: profileMaybeSingle }) }) }
      }
      return { insert }
    })

    getCurrentSession.mockReset().mockResolvedValue({ userId: 'user-1', db: { from } })
    revalidatePath.mockClear()
    notifySevereCheckin.mockReset().mockResolvedValue(undefined)
    analyzeCheckin.mockReset().mockResolvedValue([])
    getRequestOrigin.mockReset().mockResolvedValue('https://app.beacon.test')
  })

  it('analyzes the check-in for risk flags after a successful insert', async () => {
    const result = await submitCheckIn(
      undefined,
      formDataFor('medicine', {
        patient_safety: 5,
        staffing: 2,
        compliance: 1,
        supply: 1,
      })
    )

    expect(result).toEqual({ success: true })
    expect(analyzeCheckin).toHaveBeenCalledWith(
      { from },
      'checkin-1',
      'user-1',
      'medicine',
      { patient_safety: 5, staffing: 2, compliance: 1, supply: 1 },
      null,
      expect.any(Array)
    )
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/risk-flags')
  })

  it('does not analyze the check-in when the insert fails', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'insert failed' } })

    const result = await submitCheckIn(
      undefined,
      formDataFor('medicine', { patient_safety: 1, staffing: 1, compliance: 1, supply: 1 })
    )

    expect(result).toEqual({ error: 'insert failed' })
    expect(analyzeCheckin).not.toHaveBeenCalled()
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await submitCheckIn(undefined, formDataFor('medicine', { patient_safety: 1 }))

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(analyzeCheckin).not.toHaveBeenCalled()
  })
})
