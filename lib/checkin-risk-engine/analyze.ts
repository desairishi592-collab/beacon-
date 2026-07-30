import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CheckInQuestion, ManualCheckinField } from '@/lib/check-ins/questions'
import type { Database, ManualCheckinRiskFlag } from '@/lib/supabase/types'
import { computeCheckinRiskSignals } from './signals'
import { explainCheckinSignals } from './explain'

// Runs the risk analysis pipeline for one manual_checkins submission:
// compute flagged signals from its responses, get an AI-authored
// recommendation for each, and persist the result as
// manual_checkin_risk_flags rows tied to the check-in. Takes the caller's
// own db client (not a service-role client) since this always runs inside
// the user's own check-in submit action — same reasoning as the
// owner-scoped RLS policies on manual_checkins/manual_checkin_risk_flags.
// Each check-in is analyzed once at submission time — unlike schedule
// uploads or financial snapshots there's nothing to re-run against, so
// there's no delete-then-reinsert step.
export async function analyzeCheckin(
  db: SupabaseClient<Database>,
  checkinId: string,
  profileId: string,
  field: ManualCheckinField,
  responses: Record<string, number>,
  notes: string | null,
  questions: CheckInQuestion[]
): Promise<ManualCheckinRiskFlag[]> {
  const signals = computeCheckinRiskSignals(responses, questions)
  if (signals.length === 0) return []

  const explained = await explainCheckinSignals(signals, field, notes)

  const { data: inserted, error } = await db
    .from('manual_checkin_risk_flags')
    .insert(
      explained.map((signal) => ({
        checkin_id: checkinId,
        profile_id: profileId,
        signal_type: signal.type,
        severity: signal.severity,
        metric_value: signal.metricValue,
        threshold_value: signal.thresholdValue,
        metric_label: signal.metricLabel,
        title: signal.title,
        explanation: signal.explanation,
        recommendation: signal.recommendation,
        raw_signal: signal.context,
      }))
    )
    .select('*')

  if (error) throw error
  return inserted
}
