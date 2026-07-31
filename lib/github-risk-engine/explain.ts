import 'server-only'
import { chainJsonCompletion } from '@/lib/ai/chain'
import type { EngineeringSnapshot } from '@/lib/supabase/types'
import type { ExplainedRiskSignal, RiskSignal } from './types'

const SIGNAL_TYPE_LEGEND = `
- stale_pull_requests: metric_value is the age in days of the oldest open pull request.
  context.oldest_pr_number/oldest_pr_title identify it, context.open_pr_count is the total open
  PR count. Higher is worse.
- unresolved_critical_issues: metric_value is the age in days of the oldest open issue labeled
  bug/critical/security/vulnerability. context.oldest_issue_number/oldest_issue_title identify it,
  context.open_critical_issue_count is the total matching open issue count. Higher is worse.
- deploy_frequency_drop: metric_value is the period-over-period change in commits to the default
  branch over a rolling 30-day window, as a negative fraction (e.g. -0.5 = down 50%). Lower
  (more negative) is worse. context.current_commits/prior_commits are the raw counts compared.
`.trim()

const SYSTEM_PROMPT = `
You are an engineering risk analyst writing for an engineering manager who is not reviewing code
line-by-line, just scanning for delivery and stability risk. You are given engineering risk
signals that have already been computed and flagged from GitHub data by a rules engine — you are
not deciding whether something is a risk, only explaining ones that were already flagged.

Signal type reference:
${SIGNAL_TYPE_LEGEND}

For each flagged signal, write:
- title: a short, specific statement of what's wrong (under 60 characters, no jargon).
- explanation: 1-3 plain-language sentences on why this matters for delivery risk. Reference the
  actual numbers (PR/issue titles, ages, commit counts) naturally rather than just restating them.
- recommendation: 1-2 sentences on a concrete, actionable next step the engineering manager could take.

Write for someone scanning a dashboard under time pressure. Be direct and specific to this
repository's data — do not write generic advice that could apply to any flagged signal of that
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

function buildUserMessage(snapshot: EngineeringSnapshot, signals: RiskSignal[]): string {
  const payload = {
    synced_at: snapshot.synced_at,
    flagged_signals: signals.map((signal) => ({
      type: signal.type,
      severity: signal.severity,
      metric_label: signal.metricLabel,
      metric_value: signal.metricValue,
      threshold_value: signal.thresholdValue,
      context: signal.context,
    })),
  }
  return `Flagged risk signals for this GitHub sync:\n\n${JSON.stringify(payload, null, 2)}`
}

// Calls the shared AI chain to translate already-flagged, already-computed
// engineering risk signals into plain-language explanations. Returns one
// explanation per input signal, matched back by metric_label.
export async function explainEngineeringRiskSignals(
  snapshot: EngineeringSnapshot,
  signals: RiskSignal[]
): Promise<ExplainedRiskSignal[]> {
  if (signals.length === 0) return []

  const parsed = await chainJsonCompletion<ExplainOutput>({
    system: SYSTEM_PROMPT,
    user: buildUserMessage(snapshot, signals),
    schemaName: 'engineering_risk_flag_explanations',
    schema: OUTPUT_SCHEMA,
  })

  const explanationsByLabel = new Map(parsed.flags.map((flag) => [flag.metric_label, flag]))

  return signals.map((signal) => {
    const explained = explanationsByLabel.get(signal.metricLabel)
    if (!explained) {
      throw new Error(`Missing LLM explanation for engineering risk signal "${signal.metricLabel}".`)
    }
    return {
      ...signal,
      title: explained.title,
      explanation: explained.explanation,
      recommendation: explained.recommendation,
    }
  })
}
