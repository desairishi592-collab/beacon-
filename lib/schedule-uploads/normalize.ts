import type { ScheduleConcept } from './column-mapping'

export type NormalizedShift = {
  employee: string
  /** ISO calendar date, YYYY-MM-DD. */
  date: string
  /** Minutes since midnight, if a start time column was mapped and parsed. */
  startMinutes: number | null
  /** Minutes since midnight, if an end time column was mapped and parsed. */
  endMinutes: number | null
  role: string | null
  status: string | null
}

const MONTH_DAY_YEAR = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/

function parseDateLoose(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const slashMatch = trimmed.match(MONTH_DAY_YEAR)
  if (slashMatch) {
    const [, month, day, yearRaw] = slashMatch
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }

  // Falls back to the platform parser for ISO dates ("2026-07-28") and
  // written-out formats ("July 28, 2026").
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return null
}

const TIME_24H = /^(\d{1,2}):(\d{2})$/
const TIME_12H = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i

function parseTimeLoose(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const match12h = trimmed.match(TIME_12H)
  if (match12h) {
    const [, hourRaw, minuteRaw, meridiem] = match12h
    let hour = Number(hourRaw) % 12
    if (meridiem.toLowerCase() === 'p') hour += 12
    const minute = minuteRaw ? Number(minuteRaw) : 0
    return hour * 60 + minute
  }

  const match24h = trimmed.match(TIME_24H)
  if (match24h) {
    const [, hourRaw, minuteRaw] = match24h
    const hour = Number(hourRaw)
    const minute = Number(minuteRaw)
    if (hour < 24 && minute < 60) return hour * 60 + minute
  }

  return null
}

// Turns raw uploaded rows into structured shifts using only the concepts
// that were successfully mapped — an unmapped optional concept (role,
// status, times) just comes back null/empty on every shift, and signals
// that depend on it are skipped rather than guessing.
export function normalizeRows(
  rows: Record<string, string>[],
  mapping: Partial<Record<ScheduleConcept, string>>
): NormalizedShift[] {
  const employeeColumn = mapping.employee
  const dateColumn = mapping.date
  if (!employeeColumn || !dateColumn) return []

  const shifts: NormalizedShift[] = []

  for (const row of rows) {
    const employee = row[employeeColumn]?.trim()
    const date = parseDateLoose(row[dateColumn] ?? '')
    if (!employee || !date) continue

    shifts.push({
      employee,
      date,
      startMinutes: mapping.start_time ? parseTimeLoose(row[mapping.start_time] ?? '') : null,
      endMinutes: mapping.end_time ? parseTimeLoose(row[mapping.end_time] ?? '') : null,
      role: mapping.role ? row[mapping.role]?.trim() || null : null,
      status: mapping.status ? row[mapping.status]?.trim() || null : null,
    })
  }

  return shifts
}
