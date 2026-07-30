import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { explainScheduleRecommendations } = vi.hoisted(() => ({
  explainScheduleRecommendations: vi.fn(),
}))
vi.mock('./explain', () => ({ explainScheduleRecommendations }))

import { analyzeScheduleUpload } from './analyze'

function makeDb({
  deleteError = null,
  insertError = null,
  inserted = [] as unknown[],
}: {
  deleteError?: { message: string } | null
  insertError?: { message: string } | null
  inserted?: unknown[]
} = {}) {
  const eqDelete = vi.fn().mockResolvedValue({ error: deleteError })
  const del = vi.fn(() => ({ eq: eqDelete }))
  const select = vi.fn().mockResolvedValue({ data: inserted, error: insertError })
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn(() => ({ delete: del, insert }))
  return { from, del, eqDelete, insert, select }
}

describe('analyzeScheduleUpload', () => {
  const mapping = { employee: 'Name', date: 'Date', role: 'Role' } as const

  beforeEach(() => {
    explainScheduleRecommendations.mockReset().mockImplementation((signals) => Promise.resolve(signals))
  })

  it('deletes existing flags for the upload before computing new ones', async () => {
    const db = makeDb()
    await analyzeScheduleUpload(db as never, 'upload-1', 'profile-1', [], mapping)

    expect(db.from).toHaveBeenCalledWith('schedule_risk_flags')
    expect(db.del).toHaveBeenCalled()
    expect(db.eqDelete).toHaveBeenCalledWith('upload_id', 'upload-1')
  })

  it('returns an empty array and skips insert when no signals are computed', async () => {
    const db = makeDb()
    const rows = [
      { Name: 'A', Date: '2026-07-01', Role: 'RN' },
      { Name: 'B', Date: '2026-07-01', Role: 'RN' },
    ]

    const result = await analyzeScheduleUpload(db as never, 'upload-1', 'profile-1', rows, mapping)

    expect(result).toEqual([])
    expect(db.insert).not.toHaveBeenCalled()
    expect(explainScheduleRecommendations).not.toHaveBeenCalled()
  })

  it('inserts computed flags scoped to the upload and profile', async () => {
    const insertedRow = { id: 'flag-1' }
    const db = makeDb({ inserted: [insertedRow] })

    const rows = Array.from({ length: 5 }, (_, i) => ({
      Name: 'Jane Doe',
      Date: `2026-07-0${i + 1}`,
      Role: 'Charge Nurse',
    }))

    const result = await analyzeScheduleUpload(db as never, 'upload-1', 'profile-1', rows, mapping)

    expect(result).toEqual([insertedRow])
    expect(db.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        upload_id: 'upload-1',
        profile_id: 'profile-1',
        signal_type: 'single_point_of_failure',
      }),
    ])
  })

  it('persists the AI-generated recommendation in place of the deterministic one', async () => {
    const db = makeDb({ inserted: [{ id: 'flag-1' }] })
    explainScheduleRecommendations.mockImplementation((signals) =>
      Promise.resolve(signals.map((s: { recommendation: string }) => ({ ...s, recommendation: 'AI fix' })))
    )

    const rows = Array.from({ length: 5 }, (_, i) => ({
      Name: 'Jane Doe',
      Date: `2026-07-0${i + 1}`,
      Role: 'Charge Nurse',
    }))

    await analyzeScheduleUpload(db as never, 'upload-1', 'profile-1', rows, mapping)

    expect(db.insert).toHaveBeenCalledWith([
      expect.objectContaining({ recommendation: 'AI fix' }),
    ])
  })

  it('propagates a delete error', async () => {
    const db = makeDb({ deleteError: { message: 'delete failed' } })

    await expect(analyzeScheduleUpload(db as never, 'upload-1', 'profile-1', [], mapping)).rejects.toEqual({
      message: 'delete failed',
    })
  })

  it('propagates an insert error', async () => {
    const db = makeDb({ insertError: { message: 'insert failed' } })
    const rows = Array.from({ length: 5 }, (_, i) => ({
      Name: 'Jane Doe',
      Date: `2026-07-0${i + 1}`,
      Role: 'Charge Nurse',
    }))

    await expect(
      analyzeScheduleUpload(db as never, 'upload-1', 'profile-1', rows, mapping)
    ).rejects.toEqual({ message: 'insert failed' })
  })
})
