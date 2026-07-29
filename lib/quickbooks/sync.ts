import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEnv } from '@/lib/env'
import { getQuickbooksConnection, getValidAccessToken } from './client'
import {
  extractCashBalance,
  extractDebtService,
  extractProfitAndLoss,
  fetchBalanceSheetReport,
  fetchCashFlowReport,
  fetchProfitAndLossReport,
} from './reports'

const DEFAULT_MONTHS_TO_SYNC = 6

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// The last `months` completed calendar months (oldest first) — the current,
// still-in-progress month is excluded.
function monthPeriods(months: number): { start: string; end: string }[] {
  const now = new Date()
  const periods: { start: string; end: string }[] = []
  for (let i = 1; i <= months; i++) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const start = new Date(end.getFullYear(), end.getMonth(), 1)
    periods.push({ start: toDateString(start), end: toDateString(end) })
  }
  return periods.reverse()
}

export type QuickbooksSyncResult = {
  snapshotsSynced: number
  latestSnapshotId: string | null
}

// Pulls Profit & Loss, Balance Sheet, and Cash Flow reports for the last
// `months` completed calendar months and upserts one financial_snapshots
// row per period. Triggers the risk analysis engine for the most recent
// period once ingestion finishes, via POST /api/risk-analysis rather than
// calling the engine in-process — that endpoint is the intended entry point
// for "a new snapshot landed", shared-secret-gated so it can also be hit by
// other future ingestion sources without importing risk-engine internals.
export async function syncQuickbooksData(
  profileId: string,
  origin: string,
  months = DEFAULT_MONTHS_TO_SYNC
): Promise<QuickbooksSyncResult> {
  const connection = await getQuickbooksConnection(profileId)
  if (!connection) {
    throw new Error('QuickBooks is not connected for this profile.')
  }

  const accessToken = await getValidAccessToken(connection)
  const db = createAdminClient()

  let latestSnapshotId: string | null = null
  let snapshotsSynced = 0

  for (const { start, end } of monthPeriods(months)) {
    const [profitAndLoss, balanceSheet, cashFlow] = await Promise.all([
      fetchProfitAndLossReport(connection.realm_id, accessToken, start, end),
      fetchBalanceSheetReport(connection.realm_id, accessToken, end),
      fetchCashFlowReport(connection.realm_id, accessToken, start, end),
    ])

    const { totalRevenue, totalExpenses, operatingIncome, expenseBreakdown } = extractProfitAndLoss(profitAndLoss)

    // Skip periods QuickBooks has no data for at all (common for months
    // before the sandbox company's books start) instead of writing empty rows.
    if (totalRevenue === 0 && totalExpenses === 0) continue

    const { data: row, error } = await db
      .from('financial_snapshots')
      .upsert(
        {
          profile_id: profileId,
          period_start: start,
          period_end: end,
          cash_balance: extractCashBalance(balanceSheet),
          total_revenue: totalRevenue,
          total_expenses: totalExpenses,
          operating_income: operatingIncome,
          total_debt_service: extractDebtService(cashFlow),
          expense_breakdown: expenseBreakdown,
          source: 'quickbooks',
        },
        { onConflict: 'profile_id,period_end' }
      )
      .select('id')
      .single()

    if (error) throw error

    snapshotsSynced += 1
    latestSnapshotId = row.id
  }

  const { error: touchError } = await db
    .from('quickbooks_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connection.id)
  if (touchError) throw touchError

  if (latestSnapshotId) {
    // Best-effort: a risk-engine failure shouldn't fail the whole sync — the
    // ingested snapshots are still valuable and can be re-analyzed later.
    try {
      await triggerRiskAnalysis(origin, latestSnapshotId)
    } catch (error) {
      console.error('Risk analysis trigger failed after QuickBooks sync:', error)
    }
  }

  return { snapshotsSynced, latestSnapshotId }
}

async function triggerRiskAnalysis(origin: string, snapshotId: string): Promise<void> {
  const response = await fetch(new URL('/api/risk-analysis', origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-risk-analysis-secret': requireEnv('RISK_ANALYSIS_TRIGGER_SECRET'),
    },
    body: JSON.stringify({ snapshot_id: snapshotId }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Risk analysis trigger failed (${response.status}): ${detail}`)
  }
}
