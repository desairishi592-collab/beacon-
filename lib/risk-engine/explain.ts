import 'server-only'
import { chainJsonCompletion } from '@/lib/ai/chain'
import type { FinancialSnapshot } from '@/lib/supabase/types'
import type { ExplainedRiskSignal, RiskSignal } from './types'

const SIGNAL_TYPE_LEGEND = `
- cash_runway: metric_value is months of cash left at the current burn rate. Lower is worse.
- burn_rate: metric_value is either a monthly cash-burn amount (when the business just flipped
  from profitable/breakeven to burning cash — threshold_value is 0) or the period-over-period
  growth rate in monthly burn, as a fraction (e.g. 0.3 = burn grew 30%). Higher is worse.
- dscr: metric_value is the debt service coverage ratio (operating income / debt service due).
  Below 1.0 means operating income can't cover debt payments this period. Lower is worse.
- expense_concentration: metric_value is the largest expense category's share of total expenses,
  as a fraction (e.g. 0.55 = 55%). context.category names the category. Higher is worse.
- anomaly: metric_value is a period-over-period percent change, as a fraction (e.g. -0.3 = down
  30%, 0.6 = up 60%). metric_label names the metric that moved (e.g. total_revenue, or
  expense_breakdown.<category> for a single category spike).
`.trim()

const SYSTEM_PROMPT = `
You are a financial risk analyst writing for a small business finance manager who is not a
trained accountant. You are given financial risk signals that have already been computed and
flagged by a rules engine — you are not deciding whether something is a risk, only explaining
ones that were already flagged.

Signal type reference:
${SIGNAL_TYPE_LEGEND}

For each flagged signal, write:
- title: a short, specific statement of what's wrong (under 60 characters, no jargon).
- explanation: 1-3 plain-language sentences on why this matters for the business. Reference the
  actual numbers naturally, but explain what they mean rather than just restating them.
- recommendation: 1-2 sentences on a concrete, actionable next step the finance manager could take.

Write for someone scanning a dashboard under time pressure. Be direct and specific to this
business's numbers — do not write generic advice that could apply to any flagged signal of that
type. Do not hedge with disclaimers about needing more information; work with what you're given.

Respond with a JSON object matching the given schema — one entry per flagged signal, matched
back by metric_label.
`.trim()

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric_label: { type: 'string' },
          title: { type: 'string' },
          explanation: { type: 'string' },
          recommendation: { type: 'string' },
        },
        required: ['metric_label', 'title', 'explanation', 'recommendation'],
        additionalProperties: false,
      },
    },
  },
  required: ['flags'],
  additionalProperties: false,
} as const

type ExplainOutput = {
  flags: { metric_label: string; title: string; explanation: string; recommendation: string }[]
}

function buildUserMessage(snapshot: FinancialSnapshot, signals: RiskSignal[]): string {
  const payload = {
    period_start: snapshot.period_start,
    period_end: snapshot.period_end,
    flagged_signals: signals.map((signal) => ({
      type: signal.type,
      severity: signal.severity,
      metric_label: signal.metricLabel,
      metric_value: signal.metricValue,
      threshold_value: signal.thresholdValue,
      context: signal.context,
    })),
  }
  return `Flagged risk signals for this period:\n\n${JSON.stringify(payload, null, 2)}`
}

// Calls Groq to translate already-flagged, already-computed risk signals
// into plain-language explanations. Returns one explanation per input
// signal, matched back by metric_label.
export async function explainRiskSignals(
  snapshot: FinancialSnapshot,
  signals: RiskSignal[]
): Promise<ExplainedRiskSignal[]> {
  if (signals.length === 0) return []

  const parsed = await chainJsonCompletion<ExplainOutput>({
    system: SYSTEM_PROMPT,
    user: buildUserMessage(snapshot, signals),
    schemaName: 'risk_flag_explanations',
    schema: OUTPUT_SCHEMA,
  })

  const explanationsByLabel = new Map(parsed.flags.map((flag) => [flag.metric_label, flag]))

  return signals.map((signal) => {
    const explained = explanationsByLabel.get(signal.metricLabel)
    if (!explained) {
      throw new Error(`Missing LLM explanation for risk signal "${signal.metricLabel}".`)
    }
    return {
      ...signal,
      title: explained.title,
      explanation: explained.explanation,
      recommendation: explained.recommendation,
    }
  })
}
