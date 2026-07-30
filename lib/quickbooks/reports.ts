import 'server-only'
import { quickbooksApiGet } from './client'

// QuickBooks report JSON is a tree of Sections (identified by `group`, e.g.
// "Income", "Expenses", "BankAccounts", "FinancingActivities") that can
// nest, plus leaf "Data" rows for individual accounts. Only the fields we
// actually read are typed here.
type ReportColumnValue = { value?: string }
type ReportRow = {
  type?: string
  group?: string
  ColData?: ReportColumnValue[]
  Summary?: { ColData?: ReportColumnValue[] }
  Rows?: { Row?: ReportRow[] }
}
export type QuickbooksReport = { Rows?: { Row?: ReportRow[] } }

function parseAmount(value: string | undefined): number {
  const amount = Number.parseFloat(value ?? '')
  return Number.isFinite(amount) ? amount : 0
}

// A section's total is its Summary row's last column (the label + any
// comparison columns come first; for a single-period report that's just
// [label, amount]).
function sectionTotal(section: ReportRow | null): number {
  const cols = section?.Summary?.ColData
  return cols?.length ? parseAmount(cols[cols.length - 1]?.value) : 0
}

function findSectionByGroup(rows: ReportRow[], group: string): ReportRow | null {
  for (const row of rows) {
    if (row.group === group) return row
    if (row.Rows?.Row) {
      const found = findSectionByGroup(row.Rows.Row, group)
      if (found) return found
    }
  }
  return null
}

// Recursively collects every leaf "Data" row's (label -> amount), flattening
// nested subsections (e.g. an Expenses category with sub-accounts).
function collectLeafAmounts(rows: ReportRow[] | undefined, acc: Record<string, number>): void {
  if (!rows) return
  for (const row of rows) {
    if (row.Rows?.Row) {
      collectLeafAmounts(row.Rows.Row, acc)
      continue
    }
    if (!row.ColData?.length) continue
    const label = row.ColData[0]?.value
    if (!label) continue
    const amount = parseAmount(row.ColData[row.ColData.length - 1]?.value)
    acc[label] = (acc[label] ?? 0) + amount
  }
}

export type ProfitAndLossTotals = {
  totalRevenue: number
  totalExpenses: number
  operatingIncome: number
  expenseBreakdown: Record<string, number>
}

export function extractProfitAndLoss(report: QuickbooksReport): ProfitAndLossTotals {
  const rows = report.Rows?.Row ?? []
  const incomeSection = findSectionByGroup(rows, 'Income')
  const expensesSection = findSectionByGroup(rows, 'Expenses')
  const netOperatingSection = findSectionByGroup(rows, 'NetOperatingIncome')

  const totalRevenue = sectionTotal(incomeSection)
  const totalExpenses = sectionTotal(expensesSection)
  const expenseBreakdown: Record<string, number> = {}
  collectLeafAmounts(expensesSection?.Rows?.Row, expenseBreakdown)

  return {
    totalRevenue,
    totalExpenses,
    // Falls back to revenue minus expenses if the report has no dedicated
    // "Net Operating Income" section (e.g. no Other Income/Expense lines).
    operatingIncome: netOperatingSection ? sectionTotal(netOperatingSection) : totalRevenue - totalExpenses,
    expenseBreakdown,
  }
}

// Cash on hand as of the report's end date: the Balance Sheet's Bank
// Accounts subtotal, falling back to summing Asset accounts that look like
// cash/bank if the report doesn't group them separately.
export function extractCashBalance(report: QuickbooksReport): number {
  const rows = report.Rows?.Row ?? []
  const bankSection = findSectionByGroup(rows, 'BankAccounts')
  if (bankSection) return sectionTotal(bankSection)

  const assetsSection = findSectionByGroup(rows, 'Assets')
  const leaves: Record<string, number> = {}
  collectLeafAmounts(assetsSection?.Rows?.Row, leaves)
  return Object.entries(leaves)
    .filter(([name]) => /bank|checking|savings|\bcash\b/i.test(name))
    .reduce((sum, [, amount]) => sum + amount, 0)
}

const DEBT_ACCOUNT_PATTERN = /loan|notes? payable|mortgage/i

// Debt service for the period, estimated from the Cash Flow report's
// Financing Activities section: a loan/note balance decreasing shows up
// there as a negative entry (cash paid out to reduce it). New borrowing
// (a positive entry) isn't debt service, so it's excluded. This is a
// heuristic, not a GL account for "loan payments" — QuickBooks doesn't
// report one directly.
export function extractDebtService(report: QuickbooksReport): number {
  const rows = report.Rows?.Row ?? []
  const financingSection = findSectionByGroup(rows, 'FinancingActivities')
  const leaves: Record<string, number> = {}
  collectLeafAmounts(financingSection?.Rows?.Row, leaves)
  return Object.entries(leaves)
    .filter(([name, amount]) => amount < 0 && DEBT_ACCOUNT_PATTERN.test(name))
    .reduce((sum, [, amount]) => sum + Math.abs(amount), 0)
}

export async function fetchProfitAndLossReport(
  realmId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<QuickbooksReport> {
  return quickbooksApiGet(realmId, accessToken, 'reports/ProfitAndLoss', {
    start_date: startDate,
    end_date: endDate,
  }) as Promise<QuickbooksReport>
}

export async function fetchBalanceSheetReport(
  realmId: string,
  accessToken: string,
  asOfDate: string
): Promise<QuickbooksReport> {
  return quickbooksApiGet(realmId, accessToken, 'reports/BalanceSheet', {
    end_date: asOfDate,
  }) as Promise<QuickbooksReport>
}

export async function fetchCashFlowReport(
  realmId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<QuickbooksReport> {
  return quickbooksApiGet(realmId, accessToken, 'reports/CashFlow', {
    start_date: startDate,
    end_date: endDate,
  }) as Promise<QuickbooksReport>
}
