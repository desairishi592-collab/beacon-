import { NextResponse, type NextRequest } from 'next/server'
import { analyzeSnapshot } from '@/lib/risk-engine/analyze'
import { notifyNewRiskFlags } from '@/lib/notifications/risk-flag-email'
import { getRequestOrigin } from '@/lib/request-origin'

// Triggers the risk analysis engine for one financial_snapshots row.
// Intended to be called server-to-server — by the QuickBooks ingestion job
// once a new snapshot lands, or by a manual re-run — not from the browser,
// so it's gated by a shared secret rather than a user session.
export async function POST(request: NextRequest) {
  const secret = process.env.RISK_ANALYSIS_TRIGGER_SECRET
  if (!secret || request.headers.get('x-risk-analysis-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const snapshotId = body?.snapshot_id
  if (typeof snapshotId !== 'string' || !snapshotId) {
    return NextResponse.json({ error: 'snapshot_id is required' }, { status: 400 })
  }

  try {
    const flags = await analyzeSnapshot(snapshotId)
    await notifyNewRiskFlags(flags, await getRequestOrigin())
    return NextResponse.json({ flags })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Risk analysis failed'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
