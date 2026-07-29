import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentSession, revalidatePath } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))

import { uploadSchedule } from './actions'

function makeFormData(file: File | null) {
  const formData = new FormData()
  if (file) formData.set('file', file)
  return formData
}

function csvFile(contents: string, name = 'schedule.csv') {
  return new File([contents], name, { type: 'text/csv' })
}

describe('uploadSchedule', () => {
  let upsert: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    upsert = vi.fn().mockResolvedValue({ error: null })
    from = vi.fn(() => ({ upsert }))
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    revalidatePath.mockClear()
  })

  it('parses a valid csv and upserts a summary, keyed on profile_id', async () => {
    const formData = makeFormData(csvFile('date,role,filled\n2026-07-28,RN,yes\n2026-07-29,RN,no\n'))

    const result = await uploadSchedule(undefined, formData)

    expect(result).toEqual({ success: true })
    expect(from).toHaveBeenCalledWith('schedule_uploads')
    expect(upsert).toHaveBeenCalledWith(
      {
        profile_id: 'user-1',
        filename: 'schedule.csv',
        row_count: 2,
        columns: ['date', 'role', 'filled'],
        preview_rows: [
          { date: '2026-07-28', role: 'RN', filled: 'yes' },
          { date: '2026-07-29', role: 'RN', filled: 'no' },
        ],
      },
      { onConflict: 'profile_id' }
    )
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/integrations')
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await uploadSchedule(undefined, makeFormData(csvFile('a,b\n1,2\n')))

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing file', async () => {
    const result = await uploadSchedule(undefined, makeFormData(null))

    expect(result).toEqual({ error: 'Choose a CSV file to upload.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a non-csv file', async () => {
    const result = await uploadSchedule(undefined, makeFormData(csvFile('a,b\n1,2\n', 'schedule.xlsx')))

    expect(result).toEqual({ error: 'Only .csv files are supported.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a file over the size limit', async () => {
    const bigFile = csvFile('x'.repeat(2 * 1024 * 1024 + 1))

    const result = await uploadSchedule(undefined, makeFormData(bigFile))

    expect(result).toEqual({ error: 'That file is too large (2MB max).' })
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a csv parsing error', async () => {
    const result = await uploadSchedule(undefined, makeFormData(csvFile('\n')))

    expect(result).toEqual({ error: 'The file is empty.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a DB error', async () => {
    upsert.mockResolvedValue({ error: { message: 'db is down' } })

    const result = await uploadSchedule(undefined, makeFormData(csvFile('a,b\n1,2\n')))

    expect(result).toEqual({ error: 'db is down' })
  })
})
