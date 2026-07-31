import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeEngineeringRiskSignals } from './signals'
import { explainEngineeringRiskSignals } from './explain'
import type { EngineeringRiskFlag } from '@/lib/supabase/types'

// Runs the full risk analysis pipeline for one engineering_snapshots row:
// compute risk signals, explain the flagged ones in plain language, and
// persist the result as engineering_risk_flags rows tied to the snapshot.
// Re-running for the same snapshot replaces its existing flags. Mirrors
// lib/risk-engine/analyze.ts (finance), swapping "prior period_end" for
// "prior synced_at" since GitHub snapshots aren't calendar-periodized.
export async function analyzeEngineeringSnapshot(snapshotId: string): Promise<EngineeringRiskFlag[]> {
  const db = createAdminClient()

  const { data: current, error: currentError } = await db
    .from('engineering_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .maybeSingle()

  if (currentError) throw currentError
  if (!current) throw new Error(`Engineering snapshot "${snapshotId}" not found.`)

  const { data: prior, error: priorError } = await db
    .from('engineering_snapshots')
    .select('*')
    .eq('profile_id', current.profile_id)
    .lt('synced_at', current.synced_at)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (priorError) throw priorError

  const signals = computeEngineeringRiskSignals({ current, prior })

  const { error: deleteError } = await db.from('engineering_risk_flags').delete().eq('snapshot_id', snapshotId)
  if (deleteError) throw deleteError

  if (signals.length === 0) return []

  const explained = await explainEngineeringRiskSignals(current, signals)

  const { data: inserted, error: insertError } = await db
    .from('engineering_risk_flags')
    .insert(
      explained.map((signal) => ({
        snapshot_id: current.id,
        profile_id: current.profile_id,
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
