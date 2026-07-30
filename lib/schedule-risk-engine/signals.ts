import type { NormalizedShift } from '@/lib/schedule-uploads/normalize'
import type { RiskSignal } from './types'

const MINUTES_PER_DAY = 24 * 60

// Understaffing: a role's headcount on a given day compared to that role's
// own typical (median) headcount across the dataset.
const UNDERSTAFFED_CRITICAL_RATIO = 0.25
const UNDERSTAFFED_HIGH_RATIO = 0.5
const UNDERSTAFFED_MEDIUM_RATIO = 0.75
// Need at least a few days of history for "typical" to mean anything.
const MIN_DATES_FOR_BASELINE = 3

// Single point of failure: total shifts covered by the sole employee who
// ever fills a role.
const SPOF_CRITICAL_SHIFTS = 10
const SPOF_HIGH_SHIFTS = 5
const SPOF_MIN_SHIFTS = 3

// Excessive consecutive shifts: longest run of consecutive calendar days.
const CONSECUTIVE_CRITICAL_DAYS = 10
const CONSECUTIVE_HIGH_DAYS = 8
const CONSECUTIVE_MEDIUM_DAYS = 6

// No rest violation: gap between one shift's end and the employee's next
// shift's start.
const REST_CRITICAL_MINUTES = 4 * 60
const REST_HIGH_MINUTES = 6 * 60
const REST_MEDIUM_MINUTES = 8 * 60

// Coverage gap / call-outs, matched against a status column's free text.
const ABSENCE_STATUS_KEYWORDS = [
  'callout',
  'call out',
  'no show',
  'noshow',
  'sick',
  'cancelled',
  'canceled',
  'open',
  'unfilled',
  'vacant',
  'uncovered',
]
const SAME_DAY_CALLOUT_THRESHOLD = 2
const EMPLOYEE_CALLOUT_THRESHOLD = 3

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function dayNumber(date: string): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / (1000 * 60 * 60 * 24))
}

function severityForRatio(ratio: number): RiskSignal['severity'] | null {
  if (ratio <= UNDERSTAFFED_CRITICAL_RATIO) return 'critical'
  if (ratio <= UNDERSTAFFED_HIGH_RATIO) return 'high'
  if (ratio <= UNDERSTAFFED_MEDIUM_RATIO) return 'medium'
  return null
}

function computeUnderstaffedShiftSignals(shifts: NormalizedShift[]): RiskSignal[] {
  const withRole = shifts.filter((s): s is NormalizedShift & { role: string } => s.role !== null)
  if (withRole.length === 0) return []

  // role -> date -> unique employees scheduled
  const byRole = new Map<string, Map<string, Set<string>>>()
  for (const shift of withRole) {
    if (!byRole.has(shift.role)) byRole.set(shift.role, new Map())
    const byDate = byRole.get(shift.role)!
    if (!byDate.has(shift.date)) byDate.set(shift.date, new Set())
    byDate.get(shift.date)!.add(shift.employee)
  }

  const signals: RiskSignal[] = []

  for (const [role, byDate] of byRole) {
    if (byDate.size < MIN_DATES_FOR_BASELINE) continue

    const counts = [...byDate.values()].map((employees) => employees.size)
    const typical = median(counts)
    if (typical <= 0) continue

    for (const [date, employees] of byDate) {
      const count = employees.size
      const ratio = count / typical
      const severity = severityForRatio(ratio)
      if (!severity) continue

      signals.push({
        type: 'understaffed_shift',
        severity,
        metricValue: count,
        thresholdValue: typical,
        metricLabel: `understaffed_shift:${role}:${date}`,
        title: `Understaffed ${role} coverage on ${date}`,
        explanation: `Only ${count} ${role} ${count === 1 ? 'person was' : 'people were'} scheduled on ${date}, compared to a typical ${typical} for this role.`,
        recommendation: `Review ${role} coverage for ${date} and consider adding backup or per-diem staff for shifts that fall well below the usual headcount.`,
        context: { role, date, count, typical },
      })
    }
  }

  return signals
}

function computeSingleServicePointOfFailureSignals(shifts: NormalizedShift[]): RiskSignal[] {
  const withRole = shifts.filter((s): s is NormalizedShift & { role: string } => s.role !== null)
  if (withRole.length === 0) return []

  const byRole = new Map<string, { employees: Set<string>; shiftCount: number }>()
  for (const shift of withRole) {
    if (!byRole.has(shift.role)) byRole.set(shift.role, { employees: new Set(), shiftCount: 0 })
    const entry = byRole.get(shift.role)!
    entry.employees.add(shift.employee)
    entry.shiftCount += 1
  }

  const signals: RiskSignal[] = []

  for (const [role, { employees, shiftCount }] of byRole) {
    if (employees.size !== 1 || shiftCount < SPOF_MIN_SHIFTS) continue
    const [employee] = employees

    const severity: RiskSignal['severity'] =
      shiftCount >= SPOF_CRITICAL_SHIFTS ? 'critical' : shiftCount >= SPOF_HIGH_SHIFTS ? 'high' : 'medium'

    signals.push({
      type: 'single_point_of_failure',
      severity,
      metricValue: shiftCount,
      thresholdValue: SPOF_MIN_SHIFTS,
      metricLabel: `single_point_of_failure:${role}`,
      title: `${role} coverage depends on one person`,
      explanation: `${employee} is the only staff member scheduled for the ${role} role across ${shiftCount} shifts in this data.`,
      recommendation: `Cross-train another team member to cover ${role} so a single absence doesn't leave it uncovered.`,
      context: { role, employee, shiftCount },
    })
  }

  return signals
}

function severityForStreak(days: number): RiskSignal['severity'] | null {
  if (days >= CONSECUTIVE_CRITICAL_DAYS) return 'critical'
  if (days >= CONSECUTIVE_HIGH_DAYS) return 'high'
  if (days >= CONSECUTIVE_MEDIUM_DAYS) return 'medium'
  return null
}

function longestConsecutiveStreak(sortedDayNumbers: number[]): number {
  let longest = 1
  let current = 1
  for (let i = 1; i < sortedDayNumbers.length; i++) {
    if (sortedDayNumbers[i] === sortedDayNumbers[i - 1] + 1) {
      current += 1
    } else if (sortedDayNumbers[i] !== sortedDayNumbers[i - 1]) {
      current = 1
    }
    longest = Math.max(longest, current)
  }
  return longest
}

function computeExcessiveConsecutiveShiftsSignals(shifts: NormalizedShift[]): RiskSignal[] {
  const byEmployee = new Map<string, Set<number>>()
  for (const shift of shifts) {
    if (!byEmployee.has(shift.employee)) byEmployee.set(shift.employee, new Set())
    byEmployee.get(shift.employee)!.add(dayNumber(shift.date))
  }

  const signals: RiskSignal[] = []

  for (const [employee, days] of byEmployee) {
    const sorted = [...days].sort((a, b) => a - b)
    const streak = longestConsecutiveStreak(sorted)
    const severity = severityForStreak(streak)
    if (!severity) continue

    signals.push({
      type: 'excessive_consecutive_shifts',
      severity,
      metricValue: streak,
      thresholdValue: CONSECUTIVE_MEDIUM_DAYS,
      metricLabel: `excessive_consecutive_shifts:${employee}`,
      title: `${employee} scheduled ${streak} consecutive days`,
      explanation: `${employee} is scheduled for ${streak} consecutive calendar days without a day off in this data.`,
      recommendation: `Review ${employee}'s schedule and insert a rest day — extended runs without a day off raise fatigue and burnout risk.`,
      context: { employee, streak },
    })
  }

  return signals
}

function severityForRestGap(minutes: number): RiskSignal['severity'] | null {
  if (minutes < REST_CRITICAL_MINUTES) return 'critical'
  if (minutes < REST_HIGH_MINUTES) return 'high'
  if (minutes < REST_MEDIUM_MINUTES) return 'medium'
  return null
}

function computeNoRestViolationSignals(shifts: NormalizedShift[]): RiskSignal[] {
  const timed = shifts.filter(
    (s): s is NormalizedShift & { startMinutes: number; endMinutes: number } =>
      s.startMinutes !== null && s.endMinutes !== null
  )
  if (timed.length === 0) return []

  const byEmployee = new Map<string, typeof timed>()
  for (const shift of timed) {
    if (!byEmployee.has(shift.employee)) byEmployee.set(shift.employee, [])
    byEmployee.get(shift.employee)!.push(shift)
  }

  const signals: RiskSignal[] = []

  for (const [employee, employeeShifts] of byEmployee) {
    const withAbsoluteTimes = employeeShifts
      .map((shift) => {
        const startAbs = dayNumber(shift.date) * MINUTES_PER_DAY + shift.startMinutes
        // Overnight shift: end time is earlier in the clock than start time.
        const endAbs =
          dayNumber(shift.date) * MINUTES_PER_DAY +
          (shift.endMinutes <= shift.startMinutes ? shift.endMinutes + MINUTES_PER_DAY : shift.endMinutes)
        return { ...shift, startAbs, endAbs }
      })
      .sort((a, b) => a.startAbs - b.startAbs)

    let worstGap = Infinity
    for (let i = 1; i < withAbsoluteTimes.length; i++) {
      const gap = withAbsoluteTimes[i].startAbs - withAbsoluteTimes[i - 1].endAbs
      if (gap >= 0 && gap < worstGap) worstGap = gap
    }
    if (worstGap === Infinity) continue

    const severity = severityForRestGap(worstGap)
    if (!severity) continue

    const hours = Math.round((worstGap / 60) * 10) / 10

    signals.push({
      type: 'no_rest_violation',
      severity,
      metricValue: hours,
      thresholdValue: REST_MEDIUM_MINUTES / 60,
      metricLabel: `no_rest_violation:${employee}`,
      title: `Insufficient rest between shifts for ${employee}`,
      explanation: `${employee} has as little as ${hours} hour${hours === 1 ? '' : 's'} between the end of one shift and the start of the next.`,
      recommendation: `Reschedule ${employee}'s shifts to allow at least ${REST_MEDIUM_MINUTES / 60} hours of rest between shifts.`,
      context: { employee, restHours: hours },
    })
  }

  return signals
}

function isAbsenceStatus(status: string): boolean {
  const normalized = status.toLowerCase()
  return ABSENCE_STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function severityForCount(count: number, thresholds: [number, number, number]): RiskSignal['severity'] | null {
  const [medium, high, critical] = thresholds
  if (count >= critical) return 'critical'
  if (count >= high) return 'high'
  if (count >= medium) return 'medium'
  return null
}

function computeCoverageGapSignals(shifts: NormalizedShift[]): RiskSignal[] {
  const absences = shifts.filter((s) => s.status !== null && isAbsenceStatus(s.status))
  if (absences.length === 0) return []

  const signals: RiskSignal[] = []

  const byDate = new Map<string, number>()
  for (const shift of absences) {
    byDate.set(shift.date, (byDate.get(shift.date) ?? 0) + 1)
  }
  for (const [date, count] of byDate) {
    const severity = severityForCount(count, [SAME_DAY_CALLOUT_THRESHOLD, 3, 4])
    if (!severity) continue
    signals.push({
      type: 'coverage_gap',
      severity,
      metricValue: count,
      thresholdValue: SAME_DAY_CALLOUT_THRESHOLD,
      metricLabel: `coverage_gap:date:${date}`,
      title: `Multiple coverage gaps on ${date}`,
      explanation: `${count} shifts on ${date} were recorded as open, cancelled, or a call-out/no-show.`,
      recommendation: `Confirm coverage for ${date} is filled and identify backup staff for short-notice gaps.`,
      context: { date, count },
    })
  }

  const byEmployee = new Map<string, number>()
  for (const shift of absences) {
    byEmployee.set(shift.employee, (byEmployee.get(shift.employee) ?? 0) + 1)
  }
  for (const [employee, count] of byEmployee) {
    const severity = severityForCount(count, [EMPLOYEE_CALLOUT_THRESHOLD, 5, 7])
    if (!severity) continue
    signals.push({
      type: 'coverage_gap',
      severity,
      metricValue: count,
      thresholdValue: EMPLOYEE_CALLOUT_THRESHOLD,
      metricLabel: `coverage_gap:employee:${employee}`,
      title: `Recurring coverage gaps from ${employee}`,
      explanation: `${employee} has ${count} shifts recorded as open, cancelled, or a call-out/no-show in this data.`,
      recommendation: `Check in with ${employee} about recurring absences and line up dependable backup coverage.`,
      context: { employee, count },
    })
  }

  return signals
}

// Computes every flagged risk signal for a schedule upload's normalized
// shifts. Only signals that cross a threshold are returned. Each detector
// independently checks whether it has the fields it needs (role, status,
// start/end times) and returns nothing if that data wasn't mapped.
export function computeScheduleRiskSignals(shifts: NormalizedShift[]): RiskSignal[] {
  return [
    ...computeUnderstaffedShiftSignals(shifts),
    ...computeSingleServicePointOfFailureSignals(shifts),
    ...computeExcessiveConsecutiveShiftsSignals(shifts),
    ...computeNoRestViolationSignals(shifts),
    ...computeCoverageGapSignals(shifts),
  ]
}
