import 'server-only'
import { chainJsonCompletion } from '@/lib/ai/chain'
import type { ManualCheckinField } from '@/lib/check-ins/questions'
import type { CheckinRiskSignal } from './types'

const FIELD_DESCRIPTIONS: Record<ManualCheckinField, string> = {
  medicine: 'a medical practice',
  engineering: 'a software engineering team',
  other: 'a small business',
}

function buildSystemPrompt(field: ManualCheckinField): string {
  return `
You are an operations advisor for the manager of ${FIELD_DESCRIPTIONS[field]}. You are given
concerns already flagged from their periodic self-reported check-in — a rules engine has already
decided a rating of moderate-or-worse deserves attention; you are not deciding that, only
recommending how to fix it.

For each flagged concern, write a "recommendation": 1-2 sentences on a concrete, actionable next
step the manager could take this week. Use any free-text notes they wrote to make the
recommendation specific to their actual situation — do not write generic advice that could apply
to any business reporting a concern of that type. Do not hedge with disclaimers about needing more
information; work with what you're given.

Respond with a JSON object matching the given schema — one entry per flagged concern, matched back
by metric_label.
`.trim()
}

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

function buildUserMessage(signals: CheckinRiskSignal[], notes: string | null): string {
  const payload = {
    notes,
    flagged_concerns: signals.map((signal) => ({
      metric_label: signal.metricLabel,
      severity: signal.severity,
      rating: signal.metricValue,
      prompt: signal.context.prompt,
    })),
  }
  return `Flagged check-in concerns for this submission:\n\n${JSON.stringify(payload, null, 2)}`
}

// Calls the AI chain to write a tailored recommendation for each already-
// flagged check-in concern, overriding the generic placeholder recommendation
// computed in signals.ts. The field and any free-text notes give the model
// enough situational context to write a genuinely specific fix rather than
// boilerplate advice.
export async function explainCheckinSignals(
  signals: CheckinRiskSignal[],
  field: ManualCheckinField,
  notes: string | null
): Promise<CheckinRiskSignal[]> {
  if (signals.length === 0) return []

  const parsed = await chainJsonCompletion<ExplainOutput>({
    system: buildSystemPrompt(field),
    user: buildUserMessage(signals, notes),
    schemaName: 'checkin_risk_flag_recommendations',
    schema: OUTPUT_SCHEMA,
  })

  const recommendationByLabel = new Map(
    parsed.flags.map((flag) => [flag.metric_label, flag.recommendation])
  )

  return signals.map((signal) => {
    const recommendation = recommendationByLabel.get(signal.metricLabel)
    if (!recommendation) {
      throw new Error(`Missing AI recommendation for check-in signal "${signal.metricLabel}".`)
    }
    return { ...signal, recommendation }
  })
}
