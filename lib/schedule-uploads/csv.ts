export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const PREVIEW_ROW_LIMIT = 5

export type ScheduleUploadSummary = {
  rowCount: number
  columns: string[]
  previewRows: Record<string, string>[]
}

// Minimal RFC 4180 parser: handles quoted fields containing commas,
// newlines, and escaped ("") quotes. Good enough for schedule exports out of
// spreadsheets or scheduling tools, without pulling in a CSV dependency.
function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

export function summarizeScheduleCsv(text: string): ScheduleUploadSummary {
  const rows = parseRows(text)
  if (rows.length === 0) {
    throw new Error('The file is empty.')
  }

  const [header, ...dataRows] = rows
  if (header.every((cell) => cell.trim() === '')) {
    throw new Error('Could not find a header row.')
  }
  if (dataRows.length === 0) {
    throw new Error('The file has a header row but no data rows.')
  }

  const previewRows = dataRows.slice(0, PREVIEW_ROW_LIMIT).map((row) => {
    const record: Record<string, string> = {}
    header.forEach((column, index) => {
      record[column] = row[index] ?? ''
    })
    return record
  })

  return {
    rowCount: dataRows.length,
    columns: header,
    previewRows,
  }
}
