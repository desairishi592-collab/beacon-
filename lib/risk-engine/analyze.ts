import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeRiskSignals } from './signals'
import { explainRiskSignals } from './explain'
import type { RiskFlag } from '@/lib/supabase/types'

// Runs the full risk analysis pipeline for one financial_snapshots row:
// compute risk signals, explain the flagged ones in plain language, and
// persist the result as risk_flags rows tied to the snapshot. Re-running
// for the same snapshot replaces its existing flags.
export async function analyzeSnapshot(snapshotId: string): Promise<RiskFlag[]> {
  const db = createAdminClient()

  const { data: current, error: currentError } = await db
    .from('financial_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .maybeSingle()

  if (currentError) throw currentError
  if (!current) throw new Error(`Financial snapshot "${snapshotId}" not found.`)

  const { data: prior, error: priorError } = await db
    .from('financial_snapshots')
    .select('*')
    .eq('profile_id', current.profile_id)
    .lt('period_end', current.period_end)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (priorError) throw priorError

  const signals = computeRiskSignals({ current, prior })

  const { error: deleteError } = await db.from('risk_flags').delete().eq('snapshot_id', snapshotId)
  if (deleteError) throw deleteError

  if (signals.length === 0) return []

  const explained = await explainRiskSignals(current, signals)

  const { data: inserted, error: insertError } = await db
    .from('risk_flags')
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
