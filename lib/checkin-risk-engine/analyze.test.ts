import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { explainCheckinSignals } = vi.hoisted(() => ({ explainCheckinSignals: vi.fn() }))
vi.mock('./explain', () => ({ explainCheckinSignals }))

import { analyzeCheckin } from './analyze'

const questions = [
  { id: 'patient_safety', prompt: 'Any patient safety incidents or near-misses this period?' },
]

function makeDb({
  insertError = null,
  inserted = [] as unknown[],
}: { insertError?: { message: string } | null; inserted?: unknown[] } = {}) {
  const select = vi.fn().mockResolvedValue({ data: inserted, error: insertError })
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn(() => ({ insert }))
  return { from, insert, select }
}

describe('analyzeCheckin', () => {
  beforeEach(() => {
    explainCheckinSignals.mockReset().mockImplementation((signals) => Promise.resolve(signals))
  })

  it('returns an empty array and skips both AI explanation and insert when nothing is flagged', async () => {
    const db = makeDb()

    const result = await analyzeCheckin(
      db as never,
      'checkin-1',
      'profile-1',
      'medicine',
      { patient_safety: 1 },
      null,
      questions
    )

    expect(result).toEqual([])
    expect(explainCheckinSignals).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('inserts flags scoped to the checkin and profile with the AI-authored recommendation', async () => {
    const insertedRow = { id: 'flag-1' }
    const db = makeDb({ inserted: [insertedRow] })
    explainCheckinSignals.mockImplementation((signals) =>
      Promise.resolve(signals.map((s: { recommendation: string }) => ({ ...s, recommendation: 'AI fix' })))
    )

    const result = await analyzeCheckin(
      db as never,
      'checkin-1',
      'profile-1',
      'medicine',
      { patient_safety: 5 },
      'Short-staffed twice this week.',
      questions
    )

    expect(result).toEqual([insertedRow])
    expect(explainCheckinSignals).toHaveBeenCalledWith(
      expect.any(Array),
      'medicine',
      'Short-staffed twice this week.'
    )
    expect(db.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        checkin_id: 'checkin-1',
        profile_id: 'profile-1',
        signal_type: 'checkin_concern',
        recommendation: 'AI fix',
      }),
    ])
  })

  it('propagates an insert error', async () => {
    const db = makeDb({ insertError: { message: 'insert failed' } })

    await expect(
      analyzeCheckin(db as never, 'checkin-1', 'profile-1', 'medicine', { patient_safety: 5 }, null, questions)
    ).rejects.toEqual({ message: 'insert failed' })
  })
})
