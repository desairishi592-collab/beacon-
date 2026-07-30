import { describe, expect, it } from 'vitest'
import { inferColumnMapping } from './column-mapping'

describe('inferColumnMapping', () => {
  it('maps an exact-match header set', () => {
    const result = inferColumnMapping(['employee', 'date', 'start_time', 'end_time', 'role', 'status'])

    expect(result.mapping).toEqual({
      employee: 'employee',
      date: 'date',
      start_time: 'start_time',
      end_time: 'end_time',
      role: 'role',
      status: 'status',
    })
    expect(result.missingRequired).toEqual([])
  })

  it('maps common synonyms used by different scheduling systems', () => {
    const result = inferColumnMapping([
      'Staff Name',
      'Shift Date',
      'Shift Start',
      'Shift End',
      'Department',
    ])

    expect(result.mapping.employee).toBe('Staff Name')
    expect(result.mapping.date).toBe('Shift Date')
    expect(result.mapping.start_time).toBe('Shift Start')
    expect(result.mapping.end_time).toBe('Shift End')
    expect(result.mapping.role).toBe('Department')
    expect(result.missingRequired).toEqual([])
  })

  it('maps a differently formatted DirectShifts-style export', () => {
    const result = inferColumnMapping(['Nurse Name', 'Work Date', 'Time In', 'Time Out', 'Unit', 'Attendance'])

    expect(result.mapping.employee).toBe('Nurse Name')
    expect(result.mapping.date).toBe('Work Date')
    expect(result.mapping.start_time).toBe('Time In')
    expect(result.mapping.end_time).toBe('Time Out')
    expect(result.mapping.role).toBe('Unit')
    expect(result.mapping.status).toBe('Attendance')
  })

  it('flags missing required concepts when nothing recognizable is present', () => {
    const result = inferColumnMapping(['col1', 'col2', 'col3'])

    expect(result.mapping.employee).toBeUndefined()
    expect(result.mapping.date).toBeUndefined()
    expect(result.missingRequired).toEqual(['employee', 'date'])
  })

  it('does not assign the same column to two concepts', () => {
    const result = inferColumnMapping(['Name', 'Date'])
    const assignedColumns = Object.values(result.mapping)
    expect(new Set(assignedColumns).size).toBe(assignedColumns.length)
  })

  it('leaves optional concepts unmapped when only required ones are present', () => {
    const result = inferColumnMapping(['Employee', 'Date', 'Notes'])

    expect(result.mapping.employee).toBe('Employee')
    expect(result.mapping.date).toBe('Date')
    expect(result.mapping.role).toBeUndefined()
    expect(result.mapping.status).toBeUndefined()
    expect(result.missingRequired).toEqual([])
  })
})
