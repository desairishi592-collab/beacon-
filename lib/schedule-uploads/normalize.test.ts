import { describe, expect, it } from 'vitest'
import { normalizeRows } from './normalize'

describe('normalizeRows', () => {
  const mapping = {
    employee: 'Staff Name',
    date: 'Shift Date',
    start_time: 'Start',
    end_time: 'End',
    role: 'Role',
    status: 'Status',
  } as const

  it('normalizes ISO dates and 24h times', () => {
    const [shift] = normalizeRows(
      [
        {
          'Staff Name': 'Jane Doe',
          'Shift Date': '2026-07-28',
          Start: '07:00',
          End: '19:00',
          Role: 'RN',
          Status: 'filled',
        },
      ],
      mapping
    )

    expect(shift).toEqual({
      employee: 'Jane Doe',
      date: '2026-07-28',
      startMinutes: 7 * 60,
      endMinutes: 19 * 60,
      role: 'RN',
      status: 'filled',
    })
  })

  it('normalizes US slash dates and 12h times', () => {
    const [shift] = normalizeRows(
      [
        {
          'Staff Name': 'Jane Doe',
          'Shift Date': '7/28/2026',
          Start: '7:00 AM',
          End: '7:00 PM',
          Role: 'RN',
          Status: 'filled',
        },
      ],
      mapping
    )

    expect(shift.date).toBe('2026-07-28')
    expect(shift.startMinutes).toBe(7 * 60)
    expect(shift.endMinutes).toBe(19 * 60)
  })

  it('drops rows missing the required employee or date value', () => {
    const shifts = normalizeRows(
      [
        { 'Staff Name': '', 'Shift Date': '2026-07-28' },
        { 'Staff Name': 'Jane Doe', 'Shift Date': '' },
        { 'Staff Name': 'Jane Doe', 'Shift Date': 'not a date' },
      ],
      mapping
    )

    expect(shifts).toEqual([])
  })

  it('returns null for optional concepts that were not mapped', () => {
    const shifts = normalizeRows(
      [{ 'Staff Name': 'Jane Doe', 'Shift Date': '2026-07-28' }],
      { employee: 'Staff Name', date: 'Shift Date' }
    )

    expect(shifts).toEqual([
      { employee: 'Jane Doe', date: '2026-07-28', startMinutes: null, endMinutes: null, role: null, status: null },
    ])
  })

  it('returns an empty list when a required concept has no mapping at all', () => {
    expect(normalizeRows([{ a: '1' }], { date: 'a' })).toEqual([])
  })
})
