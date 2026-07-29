import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { getCurrentSession, revalidatePath } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))

import { dismissAlert, markAlertRead } from './actions'

function formDataWith(riskFlagId: unknown) {
  const formData = new FormData()
  if (typeof riskFlagId === 'string') formData.set('riskFlagId', riskFlagId)
  return formData
}

describe('markAlertRead', () => {
  let upsert: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    upsert = vi.fn().mockResolvedValue({ error: null })
    from = vi.fn(() => ({ upsert }))
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    revalidatePath.mockClear()
  })

  it('upserts a read_at timestamp scoped to the caller and the flag', async () => {
    const result = await markAlertRead(undefined, formDataWith('flag-1'))

    expect(result).toEqual({ success: true })
    expect(from).toHaveBeenCalledWith('alert_states')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 'user-1', risk_flag_id: 'flag-1' }),
      { onConflict: 'risk_flag_id,profile_id' },
    )
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/alerts')
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await markAlertRead(undefined, formDataWith('flag-1'))

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('returns an error when the flag id is missing', async () => {
    const result = await markAlertRead(undefined, formDataWith(undefined))

    expect(result).toEqual({ error: 'Missing alert.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a DB error', async () => {
    upsert.mockResolvedValue({ error: { message: 'db is down' } })

    const result = await markAlertRead(undefined, formDataWith('flag-1'))

    expect(result).toEqual({ error: 'db is down' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('dismissAlert', () => {
  let upsert: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    upsert = vi.fn().mockResolvedValue({ error: null })
    from = vi.fn(() => ({ upsert }))
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    revalidatePath.mockClear()
  })

  it('upserts a dismissed_at timestamp scoped to the caller and the flag', async () => {
    const result = await dismissAlert(undefined, formDataWith('flag-1'))

    expect(result).toEqual({ success: true })
    expect(from).toHaveBeenCalledWith('alert_states')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 'user-1', risk_flag_id: 'flag-1' }),
      { onConflict: 'risk_flag_id,profile_id' },
    )
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/alerts')
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await dismissAlert(undefined, formDataWith('flag-1'))

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(from).not.toHaveBeenCalled()
  })
})
