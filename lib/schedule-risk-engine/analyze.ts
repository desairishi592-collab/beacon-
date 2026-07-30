import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ScheduleRiskFlag } from '@/lib/supabase/types'
import { normalizeRows } from '@/lib/schedule-uploads/normalize'
import type { ScheduleConcept } from '@/lib/schedule-uploads/column-mapping'
import { computeScheduleRiskSignals } from './signals'

// Runs the full risk analysis pipeline for one schedule_uploads row:
// normalize its rows using the confirmed column mapping, compute risk
// signals, and persist the result as schedule_risk_flags rows tied to the
// upload. Re-running for the same upload replaces its existing flags. Takes
// the caller's db client (the manager's own session, not a service-role
// client) since this always runs inside the manager's own upload/mapping
// action — same reasoning as the owner-scoped RLS policies on
// schedule_uploads and schedule_risk_flags.
export async function analyzeScheduleUpload(
  db: SupabaseClient<Database>,
  uploadId: string,
  profileId: string,
  rows: Record<string, string>[],
  mapping: Partial<Record<ScheduleConcept, string>>
): Promise<ScheduleRiskFlag[]> {
  const shifts = normalizeRows(rows, mapping)
  const signals = computeScheduleRiskSignals(shifts)

  const { error: deleteError } = await db.from('schedule_risk_flags').delete().eq('upload_id', uploadId)
  if (deleteError) throw deleteError

  if (signals.length === 0) return []

  const { data: inserted, error: insertError } = await db
    .from('schedule_risk_flags')
    .insert(
      signals.map((signal) => ({
        upload_id: uploadId,
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

  if (insertError) throw insertError

  return inserted
}
