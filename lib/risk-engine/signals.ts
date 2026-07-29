import type { FinancialSnapshot } from '@/lib/supabase/types'
import type { RiskSignal, SnapshotPair } from './types'

const AVG_DAYS_PER_MONTH = 30.4368

// Runway thresholds, in months of cash left at the current burn rate.
const RUNWAY_CRITICAL_MONTHS = 1
const RUNWAY_HIGH_MONTHS = 3
const RUNWAY_MEDIUM_MONTHS = 6

// Burn acceleration thresholds, as period-over-period growth in monthly burn.
const BURN_GROWTH_CRITICAL = 0.5
const BURN_GROWTH_HIGH = 0.3
const BURN_GROWTH_MEDIUM = 0.15

// DSCR thresholds. 1.25x is the coverage ratio commonly required by lending
// covenants; below 1.0x means operating income can't cover debt service.
const DSCR_MEDIUM = 1.25
const DSCR_HIGH = 1.0
const DSCR_CRITICAL = 0.75

// Expense concentration thresholds, as a single category's share of total expenses.
const CONCENTRATION_MEDIUM = 0.4
const CONCENTRATION_HIGH = 0.55
const CONCENTRATION_CRITICAL = 0.7

// Period-over-period change thresholds for the generic anomaly detector.
const REVENUE_DROP_HIGH = 0.25
const REVENUE_DROP_CRITICAL = 0.4
const EXPENSE_SPIKE_MEDIUM = 0.3
const EXPENSE_SPIKE_HIGH = 0.5
const CASH_DROP_MEDIUM = 0.3
const CASH_DROP_HIGH = 0.5
const CATEGORY_SPIKE_THRESHOLD = 0.6
// A category must be at least this share of total expenses to be worth
// flagging a spike in — otherwise tiny categories generate noisy anomalies.
const CATEGORY_MATERIALITY_SHARE = 0.05

function periodMonths(snapshot: FinancialSnapshot): number {
  const start = new Date(snapshot.period_start).getTime()
  const end = new Date(snapshot.period_end).getTime()
  const days = (end - start) / (1000 * 60 * 60 * 24)
  return Math.max(days / AVG_DAYS_PER_MONTH, 1 / AVG_DAYS_PER_MONTH)
}

function monthlyBurn(snapshot: FinancialSnapshot): number {
  return (snapshot.total_expenses - snapshot.total_revenue) / periodMonths(snapshot)
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null
  return (current - prior) / Math.abs(prior)
}

function computeCashRunwaySignal(current: FinancialSnapshot): RiskSignal | null {
  const burn = monthlyBurn(current)
  if (burn <= 0) return null // profitable or breakeven — no runway risk

  const runwayMonths = current.cash_balance / burn
  const severity =
    runwayMonths < RUNWAY_CRITICAL_MONTHS
      ? 'critical'
      : runwayMonths < RUNWAY_HIGH_MONTHS
        ? 'high'
        : runwayMonths < RUNWAY_MEDIUM_MONTHS
          ? 'medium'
          : null
  if (!severity) return null

  return {
    type: 'cash_runway',
    severity,
    metricValue: runwayMonths,
    thresholdValue: RUNWAY_MEDIUM_MONTHS,
    metricLabel: 'cash_runway_months',
    context: {
      cash_balance: current.cash_balance,
      monthly_burn: burn,
    },
  }
}

function computeBurnRateSignal(current: FinancialSnapshot, prior: FinancialSnapshot | null): RiskSignal | null {
  const burn = monthlyBurn(current)
  if (burn <= 0) return null // not currently burning cash

  if (!prior) return null // no baseline to compare acceleration against
  const priorBurn = monthlyBurn(prior)

  if (priorBurn <= 0) {
    // Flipped from profitable/breakeven to burning cash — worth flagging on
    // its own, even without a meaningful percentage change to report.
    return {
      type: 'burn_rate',
      severity: 'medium',
      metricValue: burn,
      thresholdValue: 0,
      metricLabel: 'monthly_burn',
      context: { monthly_burn: burn, prior_monthly_burn: priorBurn },
    }
  }

  const growth = (burn - priorBurn) / priorBurn
  const severity =
    growth >= BURN_GROWTH_CRITICAL
      ? 'critical'
      : growth >= BURN_GROWTH_HIGH
        ? 'high'
        : growth >= BURN_GROWTH_MEDIUM
          ? 'medium'
          : null
  if (!severity) return null

  return {
    type: 'burn_rate',
    severity,
    metricValue: growth,
    thresholdValue: BURN_GROWTH_MEDIUM,
    metricLabel: 'monthly_burn_growth',
    context: { monthly_burn: burn, prior_monthly_burn: priorBurn },
  }
}

function computeDscrSignal(current: FinancialSnapshot): RiskSignal | null {
  if (current.total_debt_service <= 0) return null // no debt obligations this period

  const dscr = current.operating_income / current.total_debt_service
  const severity =
    dscr < DSCR_CRITICAL ? 'critical' : dscr < DSCR_HIGH ? 'high' : dscr < DSCR_MEDIUM ? 'medium' : null
  if (!severity) return null

  return {
    type: 'dscr',
    severity,
    metricValue: dscr,
    thresholdValue: DSCR_MEDIUM,
    metricLabel: 'dscr',
    context: {
      operating_income: current.operating_income,
      total_debt_service: current.total_debt_service,
    },
  }
}

function computeExpenseConcentrationSignal(current: FinancialSnapshot): RiskSignal | null {
  const categories = Object.entries(current.expense_breakdown)
  if (categories.length === 0 || current.total_expenses <= 0) return null

  const [topCategory, topAmount] = categories.reduce((max, entry) => (entry[1] > max[1] ? entry : max))
  const share = topAmount / current.total_expenses
  const severity =
    share >= CONCENTRATION_CRITICAL
      ? 'critical'
      : share >= CONCENTRATION_HIGH
        ? 'high'
        : share >= CONCENTRATION_MEDIUM
          ? 'medium'
          : null
  if (!severity) return null

  return {
    type: 'expense_concentration',
    severity,
    metricValue: share,
    thresholdValue: CONCENTRATION_MEDIUM,
    metricLabel: `expense_concentration:${topCategory}`,
    context: {
      category: topCategory,
      category_amount: topAmount,
      total_expenses: current.total_expenses,
    },
  }
}

function computeAnomalySignals(current: FinancialSnapshot, prior: FinancialSnapshot | null): RiskSignal[] {
  if (!prior) return []
  const signals: RiskSignal[] = []

  const revenueChange = pctChange(current.total_revenue, prior.total_revenue)
  if (revenueChange !== null && revenueChange <= -REVENUE_DROP_HIGH) {
    signals.push({
      type: 'anomaly',
      severity: revenueChange <= -REVENUE_DROP_CRITICAL ? 'critical' : 'high',
      metricValue: revenueChange,
      thresholdValue: -REVENUE_DROP_HIGH,
      metricLabel: 'anomaly:total_revenue',
      context: { current: current.total_revenue, prior: prior.total_revenue },
    })
  }

  const expenseChange = pctChange(current.total_expenses, prior.total_expenses)
  if (expenseChange !== null && expenseChange >= EXPENSE_SPIKE_MEDIUM) {
    signals.push({
      type: 'anomaly',
      severity: expenseChange >= EXPENSE_SPIKE_HIGH ? 'high' : 'medium',
      metricValue: expenseChange,
      thresholdValue: EXPENSE_SPIKE_MEDIUM,
      metricLabel: 'anomaly:total_expenses',
      context: { current: current.total_expenses, prior: prior.total_expenses },
    })
  }

  const cashChange = pctChange(current.cash_balance, prior.cash_balance)
  if (cashChange !== null && cashChange <= -CASH_DROP_MEDIUM) {
    signals.push({
      type: 'anomaly',
      severity: cashChange <= -CASH_DROP_HIGH ? 'high' : 'medium',
      metricValue: cashChange,
      thresholdValue: -CASH_DROP_MEDIUM,
      metricLabel: 'anomaly:cash_balance',
      context: { current: current.cash_balance, prior: prior.cash_balance },
    })
  }

  for (const [category, amount] of Object.entries(current.expense_breakdown)) {
    if (current.total_expenses <= 0 || amount / current.total_expenses < CATEGORY_MATERIALITY_SHARE) continue
    const priorAmount = prior.expense_breakdown[category]
    if (priorAmount === undefined) continue
    const change = pctChange(amount, priorAmount)
    if (change !== null && change >= CATEGORY_SPIKE_THRESHOLD) {
      signals.push({
        type: 'anomaly',
        severity: 'medium',
        metricValue: change,
        thresholdValue: CATEGORY_SPIKE_THRESHOLD,
        metricLabel: `anomaly:expense_breakdown.${category}`,
        context: { category, current: amount, prior: priorAmount },
      })
    }
  }

  return signals
}

// Computes every flagged risk signal for a snapshot. Only signals that
// cross a threshold are returned — this is the "flagging" step; plain-
// language explanation happens separately (see lib/risk-engine/explain.ts).
export function computeRiskSignals({ current, prior }: SnapshotPair): RiskSignal[] {
  return [
    computeCashRunwaySignal(current),
    computeBurnRateSignal(current, prior),
    computeDscrSignal(current),
    computeExpenseConcentrationSignal(current),
    ...computeAnomalySignals(current, prior),
  ].filter((signal): signal is RiskSignal => signal !== null)
}
