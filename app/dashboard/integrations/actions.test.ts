import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { getCurrentSession, revalidatePath, createAdminClient } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { disconnectQuickbooks } from './actions'

describe('disconnectQuickbooks', () => {
  let eq: ReturnType<typeof vi.fn>
  let del: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    eq = vi.fn().mockResolvedValue({ error: null })
    del = vi.fn(() => ({ eq }))
    from = vi.fn(() => ({ delete: del }))
    createAdminClient.mockReturnValue({ from })
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1' })
    revalidatePath.mockClear()
  })

  it('deletes the caller-owned connection row and reports success', async () => {
    const result = await disconnectQuickbooks(undefined, new FormData())

    expect(result).toEqual({ success: true })
    expect(from).toHaveBeenCalledWith('quickbooks_connections')
    expect(del).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('profile_id', 'user-1')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/integrations')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await disconnectQuickbooks(undefined, new FormData())

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a DB error', async () => {
    eq.mockResolvedValue({ error: { message: 'db is down' } })

    const result = await disconnectQuickbooks(undefined, new FormData())

    expect(result).toEqual({ error: 'db is down' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
