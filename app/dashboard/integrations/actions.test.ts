import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { getCurrentSession, revalidatePath, analyzeScheduleUpload, createAdminClient } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
  analyzeScheduleUpload: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/current-user', () => ({ getCurrentSession }))
vi.mock('@/lib/schedule-risk-engine/analyze', () => ({ analyzeScheduleUpload }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { confirmScheduleMapping, disconnectQuickbooks, uploadSchedule } from './actions'

function makeFormData(entries: Record<string, string | File | null>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    if (value !== null) formData.set(key, value)
  }
  return formData
}

function csvFile(contents: string, name = 'schedule.csv') {
  return new File([contents], name, { type: 'text/csv' })
}

describe('uploadSchedule', () => {
  let maybeSingle: ReturnType<typeof vi.fn>
  let select: ReturnType<typeof vi.fn>
  let upsert: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'upload-1' }, error: null })
    select = vi.fn(() => ({ maybeSingle }))
    upsert = vi.fn(() => ({ select }))
    from = vi.fn(() => ({ upsert }))
    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    revalidatePath.mockClear()
    analyzeScheduleUpload.mockReset()
    analyzeScheduleUpload.mockResolvedValue([{ id: 'flag-1' }, { id: 'flag-2' }])
  })

  it('parses a recognizable csv, upserts a summary, and runs analysis', async () => {
    const formData = makeFormData({
      file: csvFile('Employee,Date,Role\nJane Doe,2026-07-28,RN\nJohn Roe,2026-07-29,RN\n'),
    })

    const result = await uploadSchedule(undefined, formData)

    expect(result).toEqual({ success: true, flagCount: 2 })
    expect(from).toHaveBeenCalledWith('schedule_uploads')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 'user-1',
        filename: 'schedule.csv',
        row_count: 2,
        columns: ['Employee', 'Date', 'Role'],
        column_mapping: { employee: 'Employee', date: 'Date', role: 'Role' },
        needs_mapping: false,
      }),
      { onConflict: 'profile_id' }
    )
    expect(analyzeScheduleUpload).toHaveBeenCalledWith(
      { from },
      'upload-1',
      'user-1',
      [
        { Employee: 'Jane Doe', Date: '2026-07-28', Role: 'RN' },
        { Employee: 'John Roe', Date: '2026-07-29', Role: 'RN' },
      ],
      { employee: 'Employee', date: 'Date', role: 'Role' }
    )
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/integrations')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/risk-flags')
  })

  it('asks for a manual mapping when required columns cannot be detected, without running analysis', async () => {
    const formData = makeFormData({
      file: csvFile('col1,col2,col3\nfoo,bar,baz\n'),
    })

    const result = await uploadSchedule(undefined, formData)

    expect(result).toEqual({
      needsMapping: true,
      uploadId: 'upload-1',
      columns: ['col1', 'col2', 'col3'],
      suggestedMapping: {},
    })
    expect(analyzeScheduleUpload).not.toHaveBeenCalled()
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await uploadSchedule(undefined, makeFormData({ file: csvFile('a,b\n1,2\n') }))

    expect(result).toEqual({ error: 'Not signed in.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing file', async () => {
    const result = await uploadSchedule(undefined, makeFormData({ file: null }))

    expect(result).toEqual({ error: 'Choose a CSV file to upload.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a non-csv file', async () => {
    const result = await uploadSchedule(
      undefined,
      makeFormData({ file: csvFile('a,b\n1,2\n', 'schedule.xlsx') })
    )

    expect(result).toEqual({ error: 'Only .csv files are supported.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a file over the size limit', async () => {
    const bigFile = csvFile('x'.repeat(2 * 1024 * 1024 + 1))

    const result = await uploadSchedule(undefined, makeFormData({ file: bigFile }))

    expect(result).toEqual({ error: 'That file is too large (2MB max).' })
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a csv parsing error', async () => {
    const result = await uploadSchedule(undefined, makeFormData({ file: csvFile('\n') }))

    expect(result).toEqual({ error: 'The file is empty.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a DB error', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'db is down' } })

    const result = await uploadSchedule(
      undefined,
      makeFormData({ file: csvFile('Employee,Date\nJane,2026-07-28\n') })
    )

    expect(result).toEqual({ error: 'db is down' })
  })
})

describe('confirmScheduleMapping', () => {
  let maybeSingle: ReturnType<typeof vi.fn>
  let eqSecond: ReturnType<typeof vi.fn>
  let eqFirst: ReturnType<typeof vi.fn>
  let select: ReturnType<typeof vi.fn>
  let updateEq: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>
  let from: ReturnType<typeof vi.fn>

  beforeEach(() => {
    maybeSingle = vi.fn().mockResolvedValue({
      data: { rows: [{ Name: 'Jane Doe', 'Shift Date': '2026-07-28' }] },
      error: null,
    })
    eqSecond = vi.fn(() => ({ maybeSingle }))
    eqFirst = vi.fn(() => ({ eq: eqSecond }))
    select = vi.fn(() => ({ eq: eqFirst }))
    updateEq = vi.fn().mockResolvedValue({ error: null })
    update = vi.fn(() => ({ eq: updateEq }))
    from = vi.fn(() => ({ select, update }))

    getCurrentSession.mockReset()
    getCurrentSession.mockResolvedValue({ userId: 'user-1', db: { from } })
    revalidatePath.mockClear()
    analyzeScheduleUpload.mockReset()
    analyzeScheduleUpload.mockResolvedValue([{ id: 'flag-1' }])
  })

  it('persists the manual mapping and runs analysis', async () => {
    const formData = makeFormData({
      uploadId: 'upload-1',
      mapping_employee: 'Name',
      mapping_date: 'Shift Date',
    })

    const result = await confirmScheduleMapping(undefined, formData)

    expect(result).toEqual({ success: true, flagCount: 1 })
    expect(update).toHaveBeenCalledWith({
      column_mapping: { employee: 'Name', date: 'Shift Date' },
      needs_mapping: false,
    })
    expect(analyzeScheduleUpload).toHaveBeenCalledWith(
      { from },
      'upload-1',
      'user-1',
      [{ Name: 'Jane Doe', 'Shift Date': '2026-07-28' }],
      { employee: 'Name', date: 'Shift Date' }
    )
  })

  it('rejects a mapping missing a required concept', async () => {
    const formData = makeFormData({ uploadId: 'upload-1', mapping_employee: 'Name' })

    const result = await confirmScheduleMapping(undefined, formData)

    expect(result).toEqual({ error: 'Choose a column for both employee and shift date.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('returns an error when not signed in', async () => {
    getCurrentSession.mockResolvedValue(null)

    const result = await confirmScheduleMapping(undefined, makeFormData({ uploadId: 'upload-1' }))

    expect(result).toEqual({ error: 'Not signed in.' })
  })
})

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
