import 'server-only'
import { chainJsonCompletion } from '@/lib/ai/chain'
import type { RiskSignal } from './types'

const SYSTEM_PROMPT = `
You are a staffing operations advisor writing for a non-technical manager (in medicine,
engineering, or another operational field) who oversees a team's schedule. You are given
already-computed staffing risk signals — understaffing, single points of failure, excessive
consecutive shifts, missed rest, and coverage gaps — that a rules engine already flagged. You are
not deciding whether something is a risk, only recommending how to fix it.

For each flagged signal, write a "recommendation": 1-2 sentences on a concrete, actionable next
step the manager could take this week to address it. Be specific to the actual names, roles,
dates, and numbers given — do not write generic scheduling advice that could apply to any flagged
signal of that type. Do not hedge with disclaimers about needing more information; work with what
you're given.

Respond with a JSON object matching the given schema — one entry per flagged signal, matched back
by metric_label.
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
          recommendation: { type: 'string' },
        },
        required: ['metric_label', 'recommendation'],
        additionalProperties: false,
      },
    },
  },
  required: ['flags'],
  additionalProperties: false,
} as const

type ExplainOutput = {
  flags: { metric_label: string; recommendation: string }[]
}

function buildUserMessage(signals: RiskSignal[]): string {
  const payload = signals.map((signal) => ({
    type: signal.type,
    severity: signal.severity,
    metric_label: signal.metricLabel,
    metric_value: signal.metricValue,
    threshold_value: signal.thresholdValue,
    title: signal.title,
    explanation: signal.explanation,
    context: signal.context,
  }))
  return `Flagged staffing risk signals:\n\n${JSON.stringify(payload, null, 2)}`
}

// Calls the AI chain to write a tailored recommendation for each already-computed
// schedule risk signal, overriding the deterministic template recommendation
// computed in signals.ts. Title/explanation stay deterministic — they're
// template-shaped observations about the schedule data itself, not something
// that benefits from a model's judgment — but the fix deserves a specific,
// human-reasoned next step.
export async function explainScheduleRecommendations(signals: RiskSignal[]): Promise<RiskSignal[]> {
  if (signals.length === 0) return []

  const parsed = await chainJsonCompletion<ExplainOutput>({
    system: SYSTEM_PROMPT,
    user: buildUserMessage(signals),
    schemaName: 'schedule_risk_flag_recommendations',
    schema: OUTPUT_SCHEMA,
  })

  const recommendationByLabel = new Map(
    parsed.flags.map((flag) => [flag.metric_label, flag.recommendation])
  )

  return signals.map((signal) => {
    const recommendation = recommendationByLabel.get(signal.metricLabel)
    if (!recommendation) {
      throw new Error(`Missing AI recommendation for schedule risk signal "${signal.metricLabel}".`)
    }
    return { ...signal, recommendation }
  })
}
