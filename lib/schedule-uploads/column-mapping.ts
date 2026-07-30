// Maps whatever column headers a manager's schedule export happens to use
// (DirectShifts, a spreadsheet, any other scheduling tool) onto the fixed
// set of concepts the risk analysis engine needs. Matching is header-name
// based only — synonym lists plus a token-overlap fallback — so it works
// without ever having seen the source system.

export type ScheduleConcept = 'employee' | 'date' | 'start_time' | 'end_time' | 'role' | 'status'

export const REQUIRED_CONCEPTS: ScheduleConcept[] = ['employee', 'date']

export const ALL_CONCEPTS: ScheduleConcept[] = [
  'employee',
  'date',
  'start_time',
  'end_time',
  'role',
  'status',
]

export const CONCEPT_LABELS: Record<ScheduleConcept, string> = {
  employee: 'Employee name or ID',
  date: 'Shift date',
  start_time: 'Shift start time',
  end_time: 'Shift end time',
  role: 'Role / position',
  status: 'Shift status (filled, open, call-out, etc.)',
}

// Confidence below this is treated as "no match" — the column is left
// unmapped rather than guessed at.
const CONFIDENCE_THRESHOLD = 0.6

// Synonyms are pre-normalized (lowercase, alphanumeric only) so they can be
// compared directly against normalized headers.
const SYNONYMS: Record<ScheduleConcept, string[]> = {
  employee: [
    'employee',
    'employeename',
    'employeeid',
    'staff',
    'staffname',
    'staffid',
    'name',
    'nurse',
    'nursename',
    'worker',
    'workername',
    'provider',
    'providername',
    'person',
    'fullname',
    'lastname',
    'firstname',
  ],
  date: ['date', 'shiftdate', 'workdate', 'scheduledate', 'day', 'shiftday'],
  start_time: [
    'starttime',
    'shiftstart',
    'start',
    'timein',
    'clockin',
    'begin',
    'begintime',
    'from',
  ],
  end_time: ['endtime', 'shiftend', 'end', 'timeout', 'clockout', 'finish', 'finishtime', 'to'],
  role: ['role', 'position', 'title', 'jobtitle', 'department', 'unit', 'specialty', 'jobrole'],
  status: [
    'status',
    'shiftstatus',
    'coverage',
    'filled',
    'attendance',
    'callout',
    'noshow',
    'state',
  ],
}

function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function tokenize(header: string): string[] {
  return header
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

// Scores how well one column header matches one concept, 0-1.
function scoreColumn(header: string, concept: ScheduleConcept): number {
  const normalized = normalize(header)
  if (normalized.length === 0) return 0

  const synonyms = SYNONYMS[concept]

  if (synonyms.includes(normalized)) return 1

  // Substring match either direction (e.g. header "employeename" contains
  // synonym "employee"; header "id" is contained by synonym "employeeid").
  const substringMatch = synonyms.some(
    (synonym) => normalized.includes(synonym) || synonym.includes(normalized)
  )
  if (substringMatch) return 0.85

  // Token overlap fallback, e.g. header "Shift Start Time" tokenizes to
  // ["shift", "start", "time"], overlapping the "start_time" concept's own
  // tokens even though no single synonym matches verbatim.
  const headerTokens = new Set(tokenize(header))
  const conceptTokens = tokenize(concept)
  const overlap = conceptTokens.filter((token) => headerTokens.has(token)).length
  if (overlap === 0) return 0
  return 0.6 + 0.2 * (overlap / conceptTokens.length)
}

export type ColumnMappingResult = {
  mapping: Partial<Record<ScheduleConcept, string>>
  confidence: Partial<Record<ScheduleConcept, number>>
  missingRequired: ScheduleConcept[]
}

// Greedily assigns each concept to at most one column (and each column to
// at most one concept), picking the highest-confidence pairs first so two
// concepts don't fight over the same ambiguous column.
export function inferColumnMapping(columns: string[]): ColumnMappingResult {
  const candidates: { concept: ScheduleConcept; column: string; score: number }[] = []

  for (const concept of ALL_CONCEPTS) {
    for (const column of columns) {
      const score = scoreColumn(column, concept)
      if (score >= CONFIDENCE_THRESHOLD) {
        candidates.push({ concept, column, score })
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  const mapping: Partial<Record<ScheduleConcept, string>> = {}
  const confidence: Partial<Record<ScheduleConcept, number>> = {}
  const usedColumns = new Set<string>()

  for (const candidate of candidates) {
    if (mapping[candidate.concept] || usedColumns.has(candidate.column)) continue
    mapping[candidate.concept] = candidate.column
    confidence[candidate.concept] = candidate.score
    usedColumns.add(candidate.column)
  }

  const missingRequired = REQUIRED_CONCEPTS.filter((concept) => !mapping[concept])

  return { mapping, confidence, missingRequired }
}
