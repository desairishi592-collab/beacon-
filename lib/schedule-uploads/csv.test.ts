import { describe, expect, it } from 'vitest'
import { summarizeScheduleCsv } from './csv'

describe('summarizeScheduleCsv', () => {
  it('summarizes a simple csv', () => {
    const csv = 'date,role,filled\n2026-07-28,RN,yes\n2026-07-29,RN,no\n'
    const summary = summarizeScheduleCsv(csv)

    expect(summary.columns).toEqual(['date', 'role', 'filled'])
    expect(summary.rowCount).toBe(2)
    expect(summary.previewRows).toEqual([
      { date: '2026-07-28', role: 'RN', filled: 'yes' },
      { date: '2026-07-29', role: 'RN', filled: 'no' },
    ])
  })

  it('handles quoted fields containing commas and escaped quotes', () => {
    const csv = 'name,note\n"Doe, Jane","Said ""ok"""\n'
    const summary = summarizeScheduleCsv(csv)

    expect(summary.previewRows).toEqual([{ name: 'Doe, Jane', note: 'Said "ok"' }])
  })

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n3,4\r\n'
    const summary = summarizeScheduleCsv(csv)

    expect(summary.rowCount).toBe(2)
    expect(summary.previewRows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('caps the preview at 5 rows but still reports the full row count', () => {
    const dataRows = Array.from({ length: 8 }, (_, i) => `row${i}`)
    const csv = `id\n${dataRows.join('\n')}\n`
    const summary = summarizeScheduleCsv(csv)

    expect(summary.rowCount).toBe(8)
    expect(summary.previewRows).toHaveLength(5)
  })

  it('rejects an empty file', () => {
    expect(() => summarizeScheduleCsv('')).toThrow('The file is empty.')
  })

  it('rejects a file with a header but no data rows', () => {
    expect(() => summarizeScheduleCsv('date,role\n')).toThrow(
      'The file has a header row but no data rows.'
    )
  })
})
